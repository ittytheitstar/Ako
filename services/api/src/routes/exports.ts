import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const exportSchema = z.object({
  export_type: z.enum(['course_archive', 'assessment_evidence', 'engagement_metrics']),
  course_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export async function exportRoutes(fastify: FastifyInstance) {
  // Request a new export
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = exportSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;

    // Verify course exists if provided
    if (d.course_id) {
      const { rows } = await pool.query(
        `SELECT course_id FROM courses WHERE course_id = $1 AND tenant_id = $2`,
        [d.course_id, request.tenantId]
      );
      if (rows.length === 0) throw NotFound('Course not found');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day download window

    const { rows } = await pool.query(
      `INSERT INTO export_jobs
         (tenant_id, course_id, requested_by, export_type, status, expires_at, metadata)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6) RETURNING *`,
      [request.tenantId, d.course_id, request.user.sub, d.export_type,
       expiresAt.toISOString(), JSON.stringify(d.metadata)]
    );

    // Emit audit event
    await pool.query(
      `INSERT INTO audit_events (tenant_id, actor_id, event_type, resource_type, resource_id, payload)
       VALUES ($1, $2, 'export.started', 'export_job', $3, $4)`,
      [request.tenantId, request.user.sub, rows[0].export_id,
       JSON.stringify({ export_type: d.export_type, course_id: d.course_id })]
    );

    // Simulate async job processing (in production this would enqueue to a worker)
    setImmediate(async () => {
      try {
        await pool.query(
          `UPDATE export_jobs SET status = 'running', started_at = now() WHERE export_id = $1`,
          [rows[0].export_id]
        );
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 100));
        const fileKey = `exports/${rows[0].export_id}/${d.export_type}.zip`;
        await pool.query(
          `UPDATE export_jobs
           SET status = 'completed', completed_at = now(), file_key = $1, file_size_bytes = $2
           WHERE export_id = $3`,
          [fileKey, Math.floor(Math.random() * 1000000) + 10000, rows[0].export_id]
        );
        await pool.query(
          `INSERT INTO audit_events (tenant_id, actor_id, event_type, resource_type, resource_id, payload)
           VALUES ($1, $2, 'export.completed', 'export_job', $3, $4)`,
          [request.tenantId, request.user.sub, rows[0].export_id, JSON.stringify({ file_key: fileKey })]
        );
      } catch {
        await pool.query(
          `UPDATE export_jobs SET status = 'failed', error_message = $1 WHERE export_id = $2`,
          ['Processing failed', rows[0].export_id]
        );
        await pool.query(
          `INSERT INTO audit_events (tenant_id, actor_id, event_type, resource_type, resource_id, payload)
           VALUES ($1, $2, 'export.failed', 'export_job', $3, '{}')`,
          [request.tenantId, request.user.sub, rows[0].export_id]
        );
      }
    });

    return reply.status(202).send(rows[0]);
  });

  // List exports (for current tenant / user)
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { cursor, limit = 20 } = request.query as { cursor?: string; limit?: number };
    const params: unknown[] = [request.tenantId, Math.min(Number(limit), 100)];
    let query = `SELECT * FROM export_jobs WHERE tenant_id = $1`;
    if (cursor) { query += ` AND export_id < $3`; params.push(cursor); }
    query += ` ORDER BY created_at DESC LIMIT $2`;
    const { rows } = await pool.query(query, params);
    return reply.send({
      data: rows,
      nextCursor: rows.length === Number(limit) ? rows[rows.length - 1].export_id : undefined,
    });
  });

  // Get export job status
  fastify.get('/:id/status', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM export_jobs WHERE export_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Export job not found');
    return reply.send(rows[0]);
  });

  // Download (returns pre-signed URL stub / file_key)
  fastify.get('/:id/download', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM export_jobs WHERE export_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Export job not found');
    const job = rows[0];
    if (job.status !== 'completed') throw BadRequest(`Export is not ready (status: ${job.status})`);
    if (job.expires_at && new Date(job.expires_at) < new Date()) {
      throw BadRequest('Export download link has expired');
    }

    // Emit audit event for download access
    await pool.query(
      `INSERT INTO audit_events (tenant_id, actor_id, event_type, resource_type, resource_id, payload)
       VALUES ($1, $2, 'export.downloaded', 'export_job', $3, $4)`,
      [request.tenantId, request.user.sub, id, JSON.stringify({ file_key: job.file_key })]
    );

    // In production: generate a signed URL from object storage
    return reply.send({
      export_id: job.export_id,
      file_key: job.file_key,
      file_size_bytes: job.file_size_bytes,
      download_url: `/api/v1/files/exports/${job.file_key}`,
      expires_at: job.expires_at,
    });
  });
}
