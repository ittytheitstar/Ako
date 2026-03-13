import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';
import crypto from 'crypto';

const archiveSchema = z.object({
  notes: z.string().optional(),
  trigger_type: z.enum(['manual', 'scheduled', 'cohort_end', 'course_end']).default('manual'),
});

export async function archiveRoutes(fastify: FastifyInstance) {
  // Archive a course
  fastify.post('/:id/archive', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = archiveSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: courses } = await pool.query(
      `SELECT * FROM courses WHERE course_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (courses.length === 0) throw NotFound('Course not found');
    const course = courses[0];
    if (course.status === 'archived') throw BadRequest('Course is already archived');

    // Build snapshot
    const [sectionsResult, modulesResult, enrolmentsResult] = await Promise.all([
      pool.query(`SELECT * FROM course_sections WHERE course_id = $1`, [id]),
      pool.query(`SELECT * FROM course_modules WHERE course_id = $1`, [id]),
      pool.query(`SELECT COUNT(*) AS total FROM enrolments WHERE course_id = $1`, [id]),
    ]);

    const snapshot = {
      course,
      sections: sectionsResult.rows,
      modules: modulesResult.rows,
      enrolment_count: enrolmentsResult.rows[0].total,
      snapshotted_at: new Date().toISOString(),
    };
    const snapshotJson = JSON.stringify(snapshot);
    const integrityHash = crypto.createHash('sha256').update(snapshotJson).digest('hex');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update course status
      await client.query(
        `UPDATE courses SET status = 'archived', archived_at = now(), updated_at = now()
         WHERE course_id = $1 AND tenant_id = $2`,
        [id, request.tenantId]
      );

      // Create archive record
      const { rows: archiveRows } = await client.query(
        `INSERT INTO course_archives
           (tenant_id, course_id, archived_by, trigger_type, snapshot, integrity_hash, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [request.tenantId, id, request.user.sub, body.data.trigger_type, snapshotJson, integrityHash, body.data.notes]
      );

      // Emit audit event
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_id, event_type, resource_type, resource_id, payload)
         VALUES ($1, $2, 'course.archived', 'course', $3, $4)`,
        [request.tenantId, request.user.sub, id, JSON.stringify({ trigger_type: body.data.trigger_type })]
      );

      await client.query('COMMIT');
      return reply.status(201).send(archiveRows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Restore a course from archive
  fastify.post('/:id/restore', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows: courses } = await pool.query(
      `SELECT * FROM courses WHERE course_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (courses.length === 0) throw NotFound('Course not found');
    if (courses[0].status !== 'archived') throw BadRequest('Course is not archived');
    if (courses[0].legal_hold) throw BadRequest('Course is under legal hold and cannot be restored');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE courses SET status = 'published', archived_at = NULL, updated_at = now()
         WHERE course_id = $1 AND tenant_id = $2`,
        [id, request.tenantId]
      );

      // Mark archive as restored
      await client.query(
        `UPDATE course_archives SET restored_at = now(), restored_by = $1
         WHERE course_id = $2 AND restored_at IS NULL`,
        [request.user.sub, id]
      );

      // Emit audit event
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_id, event_type, resource_type, resource_id, payload)
         VALUES ($1, $2, 'course.restored', 'course', $3, $4)`,
        [request.tenantId, request.user.sub, id, '{}']
      );

      await client.query('COMMIT');

      const { rows } = await pool.query(
        `SELECT * FROM courses WHERE course_id = $1`,
        [id]
      );
      return reply.send(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Get archive record for a course
  fastify.get('/:id/archive', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT ca.* FROM course_archives ca
       JOIN courses c ON c.course_id = ca.course_id
       WHERE ca.course_id = $1 AND c.tenant_id = $2
       ORDER BY ca.archived_at DESC LIMIT 1`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Archive record not found');
    return reply.send(rows[0]);
  });

  // Apply / remove legal hold on a course
  fastify.post('/:id/legal-hold', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { hold = true } = (request.body as { hold?: boolean }) ?? {};

    const { rows } = await pool.query(
      `UPDATE courses SET legal_hold = $1, updated_at = now()
       WHERE course_id = $2 AND tenant_id = $3 RETURNING *`,
      [hold, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Course not found');

    await pool.query(
      `INSERT INTO audit_events (tenant_id, actor_id, event_type, resource_type, resource_id, payload)
       VALUES ($1, $2, $3, 'course', $4, $5)`,
      [request.tenantId, request.user.sub,
       hold ? 'course.legal_hold_applied' : 'course.legal_hold_removed',
       id, JSON.stringify({ legal_hold: hold })]
    );

    return reply.send(rows[0]);
  });

  // Assign a retention policy to a course
  fastify.post('/:id/retention-policy', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { policy_id } = (request.body as { policy_id?: string }) ?? {};
    if (!policy_id) throw BadRequest('policy_id is required');

    const { rows: policyRows } = await pool.query(
      `SELECT * FROM retention_policies WHERE policy_id = $1 AND tenant_id = $2`,
      [policy_id, request.tenantId]
    );
    if (policyRows.length === 0) throw NotFound('Retention policy not found');

    const policy = policyRows[0];
    const retentionUntil = new Date();
    retentionUntil.setMonth(retentionUntil.getMonth() + policy.retention_months);

    const { rows } = await pool.query(
      `UPDATE courses SET policy_id = $1, retention_until = $2, updated_at = now()
       WHERE course_id = $3 AND tenant_id = $4 RETURNING *`,
      [policy_id, retentionUntil.toISOString(), id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Course not found');

    await pool.query(
      `INSERT INTO audit_events (tenant_id, actor_id, event_type, resource_type, resource_id, payload)
       VALUES ($1, $2, 'retention.applied', 'course', $3, $4)`,
      [request.tenantId, request.user.sub, id,
       JSON.stringify({ policy_id, retention_until: retentionUntil })]
    );

    return reply.send(rows[0]);
  });
}
