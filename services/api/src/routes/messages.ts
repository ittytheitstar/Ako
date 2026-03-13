import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';
import { publishEvent } from '../events/publisher';
import { randomUUID } from 'crypto';

const messageSchema = z.object({
  body: z.record(z.unknown()),
});

const conversationSchema = z.object({
  member_ids: z.array(z.string().uuid()).min(1),
  convo_type: z.enum(['dm', 'cohort', 'course', 'support']).default('dm'),
  course_id: z.string().uuid().optional(),
  cohort_id: z.string().uuid().optional(),
});

export async function messageRoutes(fastify: FastifyInstance) {
  fastify.get('/conversations', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT c.*,
         (SELECT count(*) FROM messages m WHERE m.conversation_id = c.conversation_id AND m.deleted_at IS NULL)::int AS message_count,
         (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.conversation_id AND m.deleted_at IS NULL) AS last_message_at,
         (SELECT mrr.read_at FROM message_read_receipts mrr WHERE mrr.conversation_id = c.conversation_id AND mrr.user_id = $1) AS last_read_at
       FROM conversations c
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
    const { rows } = await pool.query(
      `INSERT INTO conversations (tenant_id, convo_type, course_id, cohort_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [request.tenantId, body.data.convo_type, body.data.course_id ?? null, body.data.cohort_id ?? null]
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

  fastify.get('/conversations/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT c.*,
         (SELECT json_agg(json_build_object('user_id', cm.user_id, 'role', cm.role))
          FROM conversation_members cm WHERE cm.conversation_id = c.conversation_id) AS members
       FROM conversations c
       JOIN conversation_members cm2 ON cm2.conversation_id = c.conversation_id AND cm2.user_id = $1
       WHERE c.conversation_id = $2 AND c.tenant_id = $3`,
      [request.user.sub, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Conversation not found');
    return reply.send(rows[0]);
  });

  fastify.get('/conversations/:id/messages', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { cursor, limit = 50 } = request.query as { cursor?: string; limit?: number };
    const params: unknown[] = [id, request.tenantId, Math.min(Number(limit), 100)];
    let query = `SELECT m.*,
         (SELECT json_agg(json_build_object('reaction', mr.reaction, 'user_id', mr.user_id))
          FROM message_reactions mr WHERE mr.message_id = m.message_id
         ) AS reactions
       FROM messages m WHERE m.conversation_id = $1 AND m.tenant_id = $2 AND m.deleted_at IS NULL`;
    if (cursor) { query += ` AND m.message_id < $4`; params.push(cursor); }
    query += ` ORDER BY m.created_at DESC LIMIT $3`;
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
    const msg = rows[0];

    // Update read receipt for sender
    await pool.query(
      `INSERT INTO message_read_receipts (conversation_id, user_id, last_read_message_id, read_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_message_id = $3, read_at = now()`,
      [id, request.user.sub, msg.message_id]
    );

    // Fan-out notifications to other members
    const { rows: members } = await pool.query(
      `SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2`,
      [id, request.user.sub]
    );
    for (const m of members) {
      await pool.query(
        `INSERT INTO notifications (tenant_id, user_id, kind, payload)
         VALUES ($1, $2, 'message', $3)`,
        [request.tenantId, m.user_id, JSON.stringify({
          conversation_id: id,
          message_id: msg.message_id,
          author_id: request.user.sub,
        })]
      );
    }

    await publishEvent({
      eventId: randomUUID(),
      type: 'message.created',
      tenantId: request.tenantId,
      channel: `dm:${id}`,
      data: { message_id: msg.message_id, conversation_id: id, author_id: request.user.sub },
      timestamp: new Date().toISOString(),
    });

    return reply.status(201).send(msg);
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

  // Message reactions
  fastify.post('/conversations/:id/messages/:messageId/reactions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { messageId } = request.params as { id: string; messageId: string };
    const body = z.object({ reaction: z.string().min(1) }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    await pool.query(
      `INSERT INTO message_reactions (message_id, user_id, reaction) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [messageId, request.user.sub, body.data.reaction]
    );
    return reply.status(201).send({ message_id: messageId, reaction: body.data.reaction });
  });

  fastify.delete('/conversations/:id/messages/:messageId/reactions/:reaction', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { messageId, reaction } = request.params as { id: string; messageId: string; reaction: string };
    await pool.query(
      `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction = $3`,
      [messageId, request.user.sub, reaction]
    );
    return reply.status(204).send();
  });

  // Mark conversation as read
  fastify.post('/conversations/:id/read', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows: latest } = await pool.query(
      `SELECT message_id FROM messages WHERE conversation_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [id]
    );
    const lastMsgId = latest[0]?.message_id ?? null;
    await pool.query(
      `INSERT INTO message_read_receipts (conversation_id, user_id, last_read_message_id, read_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_message_id = $3, read_at = now()`,
      [id, request.user.sub, lastMsgId]
    );
    return reply.status(204).send();
  });
}
