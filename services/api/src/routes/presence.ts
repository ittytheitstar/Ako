import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest } from '@ako/shared';

const PRESENCE_TTL_SECONDS = 300; // 5 minutes

const presenceSchema = z.object({
  status: z.enum(['online', 'idle', 'offline']).default('online'),
  context_type: z.string().optional(),
  context_id: z.string().uuid().optional(),
});

export async function presenceRoutes(fastify: FastifyInstance) {
  // POST /presence – upsert current user's presence
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = presenceSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const expiresAt = new Date(Date.now() + PRESENCE_TTL_SECONDS * 1000).toISOString();
    const { rows } = await pool.query(
      `INSERT INTO presence_sessions (tenant_id, user_id, status, context_type, context_id, last_seen_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, now(), $6)
       ON CONFLICT (tenant_id, user_id)
       DO UPDATE SET status = EXCLUDED.status,
                     context_type = EXCLUDED.context_type,
                     context_id = EXCLUDED.context_id,
                     last_seen_at = now(),
                     expires_at = EXCLUDED.expires_at
       RETURNING *`,
      [request.tenantId, request.user.sub, body.data.status, body.data.context_type ?? null, body.data.context_id ?? null, expiresAt]
    );

    // Also publish via Redis if available (fast path)
    try {
      const redis = fastify.redis;
      if (redis) {
        const key = `presence:${request.tenantId}:${request.user.sub}`;
        await redis.setex(key, PRESENCE_TTL_SECONDS, JSON.stringify({
          userId: request.user.sub,
          status: body.data.status,
          context_type: body.data.context_type,
          context_id: body.data.context_id,
        }));
      }
    } catch {
      // Redis optional
    }

    return reply.send(rows[0]);
  });

  // GET /presence?user_ids=uuid,uuid
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { user_ids } = request.query as { user_ids?: string };
    if (!user_ids) {
      // Return all active presence for this tenant
      const { rows } = await pool.query(
        `SELECT * FROM presence_sessions WHERE tenant_id = $1 AND expires_at > now() AND status != 'offline'`,
        [request.tenantId]
      );
      return reply.send({ data: rows });
    }

    const ids = user_ids.split(',').map(id => id.trim()).filter(Boolean);
    if (ids.length === 0) return reply.send({ data: [] });

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
    const { rows } = await pool.query(
      `SELECT * FROM presence_sessions WHERE tenant_id = $1 AND user_id IN (${placeholders}) AND expires_at > now()`,
      [request.tenantId, ...ids]
    );
    return reply.send({ data: rows });
  });

  // DELETE /presence – go offline
  fastify.delete('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    await pool.query(
      `UPDATE presence_sessions SET status = 'offline', expires_at = now()
       WHERE tenant_id = $1 AND user_id = $2`,
      [request.tenantId, request.user.sub]
    );
    try {
      const redis = fastify.redis;
      if (redis) {
        await redis.del(`presence:${request.tenantId}:${request.user.sub}`);
      }
    } catch {
      // Redis optional
    }
    return reply.status(204).send();
  });
}
