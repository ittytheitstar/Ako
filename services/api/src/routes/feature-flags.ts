import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const flagSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  enabled: z.boolean().default(false),
  rollout_pct: z.number().int().min(0).max(100).default(100),
  context: z.enum(['global', 'tenant', 'course']).default('global'),
  metadata: z.record(z.unknown()).default({}),
});

export async function featureFlagRoutes(fastify: FastifyInstance) {
  // List feature flags
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM feature_flags WHERE tenant_id = $1 OR tenant_id IS NULL ORDER BY name`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Create feature flag
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = flagSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO feature_flags (tenant_id, name, description, enabled, rollout_pct, context, metadata, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        request.tenantId,
        body.data.name,
        body.data.description,
        body.data.enabled,
        body.data.rollout_pct,
        body.data.context,
        JSON.stringify(body.data.metadata),
        request.user.sub,
      ]
    );
    return reply.status(201).send(rows[0]);
  });

  // Get feature flag
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM feature_flags WHERE flag_id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Feature flag not found');
    return reply.send(rows[0]);
  });

  // Update feature flag
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = flagSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (body.data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(body.data.name); }
    if (body.data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(body.data.description); }
    if (body.data.enabled !== undefined) { fields.push(`enabled = $${idx++}`); values.push(body.data.enabled); }
    if (body.data.rollout_pct !== undefined) { fields.push(`rollout_pct = $${idx++}`); values.push(body.data.rollout_pct); }
    if (body.data.context !== undefined) { fields.push(`context = $${idx++}`); values.push(body.data.context); }
    if (body.data.metadata !== undefined) { fields.push(`metadata = $${idx++}`); values.push(JSON.stringify(body.data.metadata)); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push(`changed_by = $${idx++}`, 'updated_at = now()');
    values.push(request.user.sub, id, request.tenantId);

    const { rows } = await pool.query(
      `UPDATE feature_flags SET ${fields.join(', ')}
       WHERE flag_id = $${idx++} AND (tenant_id = $${idx} OR tenant_id IS NULL) RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Feature flag not found');
    return reply.send(rows[0]);
  });

  // Delete feature flag
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM feature_flags WHERE flag_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Feature flag not found');
    return reply.status(204).send();
  });
}
