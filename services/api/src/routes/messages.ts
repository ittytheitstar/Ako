import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const messageSchema = z.object({
  body: z.record(z.unknown()),
});

const conversationSchema = z.object({
  member_ids: z.array(z.string().uuid()).min(1),
  convo_type: z.enum(['dm', 'cohort', 'course', 'support']).default('dm'),
});

export async function messageRoutes(fastify: FastifyInstance) {
  fastify.get('/conversations', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT c.* FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.conversation_id
       WHERE cm.user_id = $1 AND c.tenant_id = $2
       ORDER BY c.created_at DESC`,
      [request.user.sub, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/conversations', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = conversationSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    // conversations has convo_type NOT NULL, no title column
    const { rows } = await pool.query(
      `INSERT INTO conversations (tenant_id, convo_type) VALUES ($1, $2) RETURNING *`,
      [request.tenantId, body.data.convo_type]
    );
    const conv = rows[0];
    const allMembers = [...new Set([request.user.sub, ...body.data.member_ids])];
    for (const userId of allMembers) {
      await pool.query(
        `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [conv.conversation_id, userId]
      );
    }
    return reply.status(201).send(conv);
  });

  fastify.get('/conversations/:id/messages', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { cursor, limit = 50 } = request.query as { cursor?: string; limit?: number };
    const params: unknown[] = [id, request.tenantId, Math.min(Number(limit), 100)];
    let query = `SELECT * FROM messages WHERE conversation_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`;
    if (cursor) { query += ` AND message_id < $4`; params.push(cursor); }
    query += ` ORDER BY created_at DESC LIMIT $3`;
    const { rows } = await pool.query(query, params);
    return reply.send({
      data: rows.reverse(),
      nextCursor: rows.length === Number(limit) ? rows[0]?.message_id : undefined,
    });
  });

  fastify.post('/conversations/:id/messages', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = messageSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO messages (tenant_id, conversation_id, author_id, body) VALUES ($1, $2, $3, $4) RETURNING *`,
      [request.tenantId, id, request.user.sub, JSON.stringify(body.data.body)]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.delete('/conversations/:id/messages/:messageId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, messageId } = request.params as { id: string; messageId: string };
    const { rowCount } = await pool.query(
      `UPDATE messages SET deleted_at = now() WHERE message_id = $1 AND conversation_id = $2 AND author_id = $3`,
      [messageId, id, request.user.sub]
    );
    if (rowCount === 0) throw NotFound('Message not found');
    return reply.status(204).send();
  });
}
