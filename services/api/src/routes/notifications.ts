import { FastifyInstance } from 'fastify';
import { pool } from '../db/client';
import { NotFound } from '@ako/shared';

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { cursor, limit = 20 } = request.query as { cursor?: string; limit?: number };
    const params: unknown[] = [request.user.sub, request.tenantId, Math.min(Number(limit), 100)];
    let query = `SELECT * FROM notifications WHERE user_id = $1 AND tenant_id = $2`;
    if (cursor) { query += ` AND notification_id < $4`; params.push(cursor); }
    query += ` ORDER BY created_at DESC LIMIT $3`;
    const { rows } = await pool.query(query, params);
    return reply.send({
      data: rows,
      nextCursor: rows.length === Number(limit) ? rows[rows.length - 1].notification_id : undefined,
    });
  });

  fastify.post('/:id/read', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `UPDATE notifications SET read_at = now() WHERE notification_id = $1 AND user_id = $2 RETURNING *`,
      [id, request.user.sub]
    );
    if (rows.length === 0) throw NotFound('Notification not found');
    return reply.send(rows[0]);
  });

  fastify.post('/read-all', { preHandler: fastify.authenticate }, async (request, reply) => {
    await pool.query(
      `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND tenant_id = $2 AND read_at IS NULL`,
      [request.user.sub, request.tenantId]
    );
    return reply.status(204).send();
  });
}
