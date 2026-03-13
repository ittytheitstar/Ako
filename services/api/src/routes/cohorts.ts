import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

async function syncCohortEnrolments(tenantId: string, cohortId: string, userIds: string[]) {
  const { rows: methods } = await pool.query(
    `SELECT em.* FROM enrolment_methods em
     WHERE em.cohort_id = $1 AND em.tenant_id = $2 AND em.method_type = 'cohort_sync' AND em.active = TRUE`,
    [cohortId, tenantId]
  );
  for (const method of methods) {
    for (const userId of userIds) {
      await pool.query(
        `INSERT INTO enrolments (tenant_id, course_id, user_id, role, status, cohort_id)
         VALUES ($1, $2, $3, $4, 'active', $5)
         ON CONFLICT (tenant_id, course_id, user_id) DO UPDATE SET status = 'active'`,
        [tenantId, method.course_id, userId, method.default_role, cohortId]
      );
    }
  }
}

export async function cohortRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM cohorts WHERE tenant_id = $1 ORDER BY created_at`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM cohorts WHERE cohort_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Cohort not found');
    return reply.send(rows[0]);
  });

  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO cohorts (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING *`,
      [request.tenantId, body.data.code, body.data.name]
    );
    await pool.query(
      `INSERT INTO outbox_events (tenant_id, topic, key, payload) VALUES ($1, $2, $3, $4)`,
      [request.tenantId, 'cohort.created', rows[0].cohort_id, JSON.stringify(rows[0])]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.data.code !== undefined) { fields.push(`code = $${i++}`); values.push(body.data.code); }
    if (body.data.name !== undefined) { fields.push(`name = $${i++}`); values.push(body.data.name); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    values.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE cohorts SET ${fields.join(', ')} WHERE cohort_id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Cohort not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM cohorts WHERE cohort_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Cohort not found');
    return reply.status(204).send();
  });

  // Members
  fastify.get('/:id/members', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.display_name, cm.added_at
       FROM cohort_members cm
       JOIN users u ON u.user_id = cm.user_id
       WHERE cm.cohort_id = $1`,
      [id]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/members', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ user_id: z.string().uuid() }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    await pool.query(
      `INSERT INTO cohort_members (cohort_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, body.data.user_id]
    );
    await syncCohortEnrolments(request.tenantId, id, [body.data.user_id]);
    await pool.query(
      `INSERT INTO outbox_events (tenant_id, topic, key, payload) VALUES ($1, $2, $3, $4)`,
      [request.tenantId, 'cohort.member.added', id, JSON.stringify({ cohort_id: id, user_id: body.data.user_id })]
    );
    return reply.status(201).send({ cohort_id: id, user_id: body.data.user_id });
  });

  fastify.delete('/:id/members/:userId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    await pool.query(
      `DELETE FROM cohort_members WHERE cohort_id = $1 AND user_id = $2`,
      [id, userId]
    );
    await pool.query(
      `UPDATE enrolments SET status = 'suspended'
       WHERE cohort_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [id, userId, request.tenantId]
    );
    await pool.query(
      `INSERT INTO outbox_events (tenant_id, topic, key, payload) VALUES ($1, $2, $3, $4)`,
      [request.tenantId, 'cohort.member.removed', id, JSON.stringify({ cohort_id: id, user_id: userId })]
    );
    return reply.status(204).send();
  });

  // Bulk operations
  fastify.post('/:id/members/bulkAdd', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ user_ids: z.array(z.string().uuid()).min(1) }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    await pool.query(
      `INSERT INTO cohort_members (cohort_id, user_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
      [id, body.data.user_ids]
    );
    await syncCohortEnrolments(request.tenantId, id, body.data.user_ids);
    await pool.query(
      `INSERT INTO outbox_events (tenant_id, topic, key, payload) VALUES ($1, $2, $3, $4)`,
      [request.tenantId, 'cohort.member.added', id, JSON.stringify({ cohort_id: id, user_ids: body.data.user_ids })]
    );
    return reply.status(201).send({ cohort_id: id, added: body.data.user_ids.length });
  });

  fastify.post('/:id/members/bulkRemove', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ user_ids: z.array(z.string().uuid()).min(1) }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    await pool.query(
      `DELETE FROM cohort_members WHERE cohort_id = $1 AND user_id = ANY($2::uuid[])`,
      [id, body.data.user_ids]
    );
    await pool.query(
      `UPDATE enrolments SET status = 'suspended'
       WHERE cohort_id = $1 AND user_id = ANY($2::uuid[]) AND tenant_id = $3`,
      [id, body.data.user_ids, request.tenantId]
    );
    await pool.query(
      `INSERT INTO outbox_events (tenant_id, topic, key, payload) VALUES ($1, $2, $3, $4)`,
      [request.tenantId, 'cohort.member.removed', id, JSON.stringify({ cohort_id: id, user_ids: body.data.user_ids })]
    );
    return reply.send({ cohort_id: id, removed: body.data.user_ids.length });
  });

  // Reconcile sync
  fastify.post('/:id/sync/reconcile', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows: cohortRows } = await pool.query(
      `SELECT * FROM cohorts WHERE cohort_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (cohortRows.length === 0) throw NotFound('Cohort not found');

    const { rows: methods } = await pool.query(
      `SELECT em.* FROM enrolment_methods em
       WHERE em.cohort_id = $1 AND em.tenant_id = $2 AND em.method_type = 'cohort_sync' AND em.active = TRUE`,
      [id, request.tenantId]
    );

    const { rows: members } = await pool.query(
      `SELECT user_id FROM cohort_members WHERE cohort_id = $1`,
      [id]
    );

    let added = 0;
    for (const method of methods) {
      for (const member of members) {
        const result = await pool.query(
          `INSERT INTO enrolments (tenant_id, course_id, user_id, role, status, cohort_id)
           VALUES ($1, $2, $3, $4, 'active', $5)
           ON CONFLICT (tenant_id, course_id, user_id) DO UPDATE SET status = 'active'
           RETURNING (xmax = 0) AS inserted`,
          [request.tenantId, method.course_id, member.user_id, method.default_role, id]
        );
        if (result.rows[0]?.inserted) added++;
      }
    }

    await pool.query(
      `INSERT INTO outbox_events (tenant_id, topic, key, payload) VALUES ($1, $2, $3, $4)`,
      [request.tenantId, 'enrolment.reconciled', id, JSON.stringify({ cohort_id: id, courses: methods.length, added })]
    );

    return reply.send({ cohort_id: id, courses_synced: methods.length, enrolments_upserted: added });
  });
}
