import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const keySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default([]),
  expires_at: z.string().datetime().optional(),
});

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function developerKeyRoutes(fastify: FastifyInstance) {
  // List API keys (never return key_hash)
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT key_id, tenant_id, user_id, name, key_prefix, scopes, active, last_used_at, expires_at, created_at
       FROM developer_api_keys WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
      [request.tenantId, request.user.sub]
    );
    return reply.send({ data: rows });
  });

  // Create API key – returns plaintext key only once
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = keySchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const rawKey = `ako_${randomBytes(24).toString('hex')}`;
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    const { rows } = await pool.query(
      `INSERT INTO developer_api_keys (tenant_id, user_id, name, key_hash, key_prefix, scopes, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING key_id, tenant_id, user_id, name, key_prefix, scopes, active, expires_at, created_at`,
      [request.tenantId, request.user.sub, body.data.name, keyHash, keyPrefix, body.data.scopes, body.data.expires_at ?? null]
    );
    // Return the raw key only at creation time
    return reply.status(201).send({ ...rows[0], key: rawKey });
  });

  // Revoke API key
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM developer_api_keys WHERE key_id = $1 AND tenant_id = $2 AND user_id = $3`,
      [id, request.tenantId, request.user.sub]
    );
    if (rowCount === 0) throw NotFound('API key not found');
    return reply.status(204).send();
  });

  // Rotate key name
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = keySchema.pick({ name: true }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `UPDATE developer_api_keys SET name = $1 WHERE key_id = $2 AND tenant_id = $3 AND user_id = $4
       RETURNING key_id, tenant_id, user_id, name, key_prefix, scopes, active, expires_at, created_at`,
      [body.data.name, id, request.tenantId, request.user.sub]
    );
    if (rows.length === 0) throw NotFound('API key not found');
    return reply.send(rows[0]);
  });
}
