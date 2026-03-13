import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const rateLimitConfigSchema = z.object({
  route_pattern: z.string().optional(),
  window_seconds: z.number().int().min(1).max(3600).default(60),
  max_requests: z.number().int().min(1).max(100000).default(200),
  max_write_requests: z.number().int().min(1).max(100000).optional(),
  burst_multiplier: z.number().min(1).max(10).default(1.5),
  scope: z.enum(['global', 'tenant', 'api_key']).default('tenant'),
  notes: z.string().optional(),
});

export async function rateLimitRoutes(fastify: FastifyInstance) {
  // List rate limit configs for tenant
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM rate_limit_configs
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY scope, route_pattern NULLS FIRST`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Create rate limit config
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = rateLimitConfigSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows } = await pool.query(
      `INSERT INTO rate_limit_configs
         (tenant_id, route_pattern, window_seconds, max_requests, max_write_requests,
          burst_multiplier, scope, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (tenant_id, route_pattern) DO UPDATE SET
         window_seconds     = EXCLUDED.window_seconds,
         max_requests       = EXCLUDED.max_requests,
         max_write_requests = EXCLUDED.max_write_requests,
         burst_multiplier   = EXCLUDED.burst_multiplier,
         scope              = EXCLUDED.scope,
         notes              = EXCLUDED.notes,
         updated_at         = now()
       RETURNING *`,
      [
        request.tenantId,
        body.data.route_pattern ?? null,
        body.data.window_seconds,
        body.data.max_requests,
        body.data.max_write_requests ?? null,
        body.data.burst_multiplier,
        body.data.scope,
        body.data.notes ?? null,
        request.user.sub,
      ]
    );
    return reply.status(201).send(rows[0]);
  });

  // Get single rate limit config
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM rate_limit_configs
       WHERE config_id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Rate limit config not found');
    return reply.send(rows[0]);
  });

  // Update rate limit config
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = rateLimitConfigSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.data.route_pattern !== undefined) { fields.push(`route_pattern = $${idx++}`); values.push(body.data.route_pattern); }
    if (body.data.window_seconds !== undefined) { fields.push(`window_seconds = $${idx++}`); values.push(body.data.window_seconds); }
    if (body.data.max_requests !== undefined) { fields.push(`max_requests = $${idx++}`); values.push(body.data.max_requests); }
    if (body.data.max_write_requests !== undefined) { fields.push(`max_write_requests = $${idx++}`); values.push(body.data.max_write_requests); }
    if (body.data.burst_multiplier !== undefined) { fields.push(`burst_multiplier = $${idx++}`); values.push(body.data.burst_multiplier); }
    if (body.data.scope !== undefined) { fields.push(`scope = $${idx++}`); values.push(body.data.scope); }
    if (body.data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(body.data.notes); }

    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push('updated_at = now()');
    values.push(id, request.tenantId);

    const { rows } = await pool.query(
      `UPDATE rate_limit_configs SET ${fields.join(', ')}
       WHERE config_id = $${idx++} AND (tenant_id = $${idx} OR tenant_id IS NULL)
       RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Rate limit config not found');
    return reply.send(rows[0]);
  });

  // Delete rate limit config
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM rate_limit_configs WHERE config_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Rate limit config not found');
    return reply.status(204).send();
  });
}
