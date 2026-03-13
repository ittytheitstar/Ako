import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';
import { publishEvent } from '../events/publisher';
import { randomUUID } from 'crypto';

const forumSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().min(1),
  forum_type: z.enum(['general', 'announcement', 'group', 'module']).default('general'),
  settings: z.record(z.unknown()).default({}),
});

const threadSchema = z.object({
  title: z.string().min(1),
});

const postSchema = z.object({
  body: z.record(z.unknown()),
  parent_post_id: z.string().uuid().optional(),
});

async function fanOutNotifications(
  tenantId: string,
  threadId: string,
  forumId: string,
  postId: string,
  authorId: string,
  threadTitle: string
) {
  const { rows: subs } = await pool.query(
    `SELECT user_id FROM forum_subscriptions WHERE forum_id = $1 AND user_id != $2`,
    [forumId, authorId]
  );
  for (const sub of subs) {
    await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, kind, payload)
       VALUES ($1, $2, 'forum_post', $3)`,
      [tenantId, sub.user_id, JSON.stringify({
        thread_id: threadId,
        forum_id: forumId,
        post_id: postId,
        thread_title: threadTitle,
        author_id: authorId,
      })]
    );
  }
}

export async function forumRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id } = request.query as { course_id?: string };
    const params: unknown[] = [request.tenantId];
    let query = `SELECT * FROM forums WHERE tenant_id = $1`;
    if (course_id) { query += ` AND course_id = $2`; params.push(course_id); }
    query += ` ORDER BY forum_id`;
    const { rows } = await pool.query(query, params);
    return reply.send({ data: rows });
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM forums WHERE forum_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Forum not found');
    return reply.send(rows[0]);
  });

  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = forumSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO forums (tenant_id, course_id, title, forum_type, settings) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request.tenantId, body.data.course_id, body.data.title, body.data.forum_type, JSON.stringify(body.data.settings)]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = forumSchema.partial().omit({ course_id: true }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.data.title !== undefined) { fields.push(`title = $${i++}`); values.push(body.data.title); }
    if (body.data.forum_type !== undefined) { fields.push(`forum_type = $${i++}`); values.push(body.data.forum_type); }
    if (body.data.settings !== undefined) { fields.push(`settings = $${i++}`); values.push(JSON.stringify(body.data.settings)); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    values.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE forums SET ${fields.join(', ')} WHERE forum_id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Forum not found');
    return reply.send(rows[0]);
  });

  // Threads
  fastify.get('/:id/threads', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT ft.*,
         (SELECT count(*) FROM forum_posts fp WHERE fp.thread_id = ft.thread_id AND fp.deleted_at IS NULL)::int AS post_count,
         (SELECT MAX(fp.created_at) FROM forum_posts fp WHERE fp.thread_id = ft.thread_id AND fp.deleted_at IS NULL) AS last_post_at
       FROM forum_threads ft
       WHERE ft.forum_id = $1 AND ft.tenant_id = $2
       ORDER BY ft.pinned DESC, ft.created_at DESC`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.get('/:id/threads/:threadId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, threadId } = request.params as { id: string; threadId: string };
    const { rows } = await pool.query(
      `SELECT * FROM forum_threads WHERE thread_id = $1 AND forum_id = $2 AND tenant_id = $3`,
      [threadId, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Thread not found');
    return reply.send(rows[0]);
  });

  fastify.post('/:id/threads', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = threadSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO forum_threads (tenant_id, forum_id, title, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [request.tenantId, id, body.data.title, request.user.sub]
    );
    // Auto-subscribe creator
    await pool.query(
      `INSERT INTO forum_subscriptions (forum_id, thread_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [id, rows[0].thread_id, request.user.sub]
    );

    await publishEvent({
      eventId: randomUUID(),
      type: 'course.updated',
      tenantId: request.tenantId,
      channel: `forum:${id}`,
      data: { kind: 'thread.created', thread_id: rows[0].thread_id, title: body.data.title },
      timestamp: new Date().toISOString(),
    });

    return reply.status(201).send(rows[0]);
  });

  // Lock / unlock thread
  fastify.post('/:id/threads/:threadId/lock', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, threadId } = request.params as { id: string; threadId: string };
    const { rows } = await pool.query(
      `UPDATE forum_threads SET locked = TRUE WHERE thread_id = $1 AND forum_id = $2 AND tenant_id = $3 RETURNING *`,
      [threadId, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Thread not found');
    return reply.send(rows[0]);
  });

  fastify.post('/:id/threads/:threadId/unlock', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, threadId } = request.params as { id: string; threadId: string };
    const { rows } = await pool.query(
      `UPDATE forum_threads SET locked = FALSE WHERE thread_id = $1 AND forum_id = $2 AND tenant_id = $3 RETURNING *`,
      [threadId, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Thread not found');
    return reply.send(rows[0]);
  });

  // Pin / unpin thread
  fastify.post('/:id/threads/:threadId/pin', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, threadId } = request.params as { id: string; threadId: string };
    const { rows } = await pool.query(
      `UPDATE forum_threads SET pinned = TRUE WHERE thread_id = $1 AND forum_id = $2 AND tenant_id = $3 RETURNING *`,
      [threadId, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Thread not found');
    return reply.send(rows[0]);
  });

  fastify.post('/:id/threads/:threadId/unpin', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, threadId } = request.params as { id: string; threadId: string };
    const { rows } = await pool.query(
      `UPDATE forum_threads SET pinned = FALSE WHERE thread_id = $1 AND forum_id = $2 AND tenant_id = $3 RETURNING *`,
      [threadId, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Thread not found');
    return reply.send(rows[0]);
  });

  // Subscribe / unsubscribe to thread notifications
  fastify.post('/:id/threads/:threadId/subscribe', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, threadId } = request.params as { id: string; threadId: string };
    await pool.query(
      `INSERT INTO forum_subscriptions (forum_id, thread_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [id, threadId, request.user.sub]
    );
    return reply.status(204).send();
  });

  fastify.delete('/:id/threads/:threadId/subscribe', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, threadId } = request.params as { id: string; threadId: string };
    await pool.query(
      `DELETE FROM forum_subscriptions WHERE forum_id = $1 AND thread_id = $2 AND user_id = $3`,
      [id, threadId, request.user.sub]
    );
    return reply.status(204).send();
  });

  // Mark thread read
  fastify.post('/:id/threads/:threadId/read', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { threadId } = request.params as { id: string; threadId: string };
    await pool.query(
      `INSERT INTO forum_read_status (thread_id, user_id, last_read_at) VALUES ($1, $2, now())
       ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = now()`,
      [threadId, request.user.sub]
    );
    return reply.status(204).send();
  });

  // Posts
  fastify.get('/:id/threads/:threadId/posts', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { threadId } = request.params as { id: string; threadId: string };
    const { rows } = await pool.query(
      `SELECT fp.*,
         (SELECT json_agg(json_build_object('reaction', pr.reaction, 'count', pr.cnt::int))
          FROM (SELECT reaction, count(*) AS cnt FROM post_reactions WHERE post_id = fp.post_id GROUP BY reaction) pr
         ) AS reactions
       FROM forum_posts fp
       WHERE fp.thread_id = $1 AND fp.tenant_id = $2 AND fp.deleted_at IS NULL
       ORDER BY fp.created_at`,
      [threadId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/threads/:threadId/posts', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, threadId } = request.params as { id: string; threadId: string };
    const body = postSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    // Check thread not locked
    const { rows: threadRows } = await pool.query(
      `SELECT * FROM forum_threads WHERE thread_id = $1 AND tenant_id = $2`,
      [threadId, request.tenantId]
    );
    if (threadRows.length === 0) throw NotFound('Thread not found');
    if (threadRows[0].locked) throw BadRequest('Thread is locked');

    const { rows } = await pool.query(
      `INSERT INTO forum_posts (tenant_id, thread_id, author_id, body, parent_post_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request.tenantId, threadId, request.user.sub, JSON.stringify(body.data.body), body.data.parent_post_id]
    );
    const post = rows[0];

    // Auto-subscribe poster
    await pool.query(
      `INSERT INTO forum_subscriptions (forum_id, thread_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [id, threadId, request.user.sub]
    );

    // Mark thread read for poster
    await pool.query(
      `INSERT INTO forum_read_status (thread_id, user_id, last_read_at) VALUES ($1, $2, now())
       ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = now()`,
      [threadId, request.user.sub]
    );

    // Fan-out notifications to subscribers
    await fanOutNotifications(
      request.tenantId, threadId, id, post.post_id,
      request.user.sub, threadRows[0].title
    );

    // Outbox + realtime
    await pool.query(
      `INSERT INTO outbox_events (tenant_id, topic, key, payload) VALUES ($1, 'post.created', $2, $3)`,
      [request.tenantId, `forum:${id}:thread:${threadId}`, JSON.stringify({
        post_id: post.post_id, thread_id: threadId, forum_id: id, author_id: request.user.sub,
      })]
    );

    await publishEvent({
      eventId: randomUUID(),
      type: 'post.created',
      tenantId: request.tenantId,
      channel: `forum:${id}:thread:${threadId}`,
      data: { post_id: post.post_id, thread_id: threadId, forum_id: id, author_id: request.user.sub },
      timestamp: new Date().toISOString(),
    });

    return reply.status(201).send(post);
  });

  fastify.patch('/:id/threads/:threadId/posts/:postId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, threadId, postId } = request.params as { id: string; threadId: string; postId: string };
    const body = postSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    if (!body.data.body) throw BadRequest('body is required');
    const { rows } = await pool.query(
      `UPDATE forum_posts SET body = $1, updated_at = now()
       WHERE post_id = $2 AND thread_id = $3 AND author_id = $4 AND tenant_id = $5 RETURNING *`,
      [JSON.stringify(body.data.body), postId, threadId, request.user.sub, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Post not found');

    await publishEvent({
      eventId: randomUUID(),
      type: 'post.updated',
      tenantId: request.tenantId,
      channel: `forum:${id}:thread:${threadId}`,
      data: { post_id: postId, thread_id: threadId, forum_id: id },
      timestamp: new Date().toISOString(),
    });

    return reply.send(rows[0]);
  });

  fastify.delete('/:id/threads/:threadId/posts/:postId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, threadId, postId } = request.params as { id: string; threadId: string; postId: string };
    const { rowCount } = await pool.query(
      `UPDATE forum_posts SET deleted_at = now() WHERE post_id = $1 AND thread_id = $2 AND tenant_id = $3`,
      [postId, threadId, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Post not found');

    await publishEvent({
      eventId: randomUUID(),
      type: 'post.deleted',
      tenantId: request.tenantId,
      channel: `forum:${id}:thread:${threadId}`,
      data: { post_id: postId, thread_id: threadId, forum_id: id },
      timestamp: new Date().toISOString(),
    });

    return reply.status(204).send();
  });

  // Reactions
  fastify.post('/:id/threads/:threadId/posts/:postId/reactions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { postId } = request.params as { id: string; threadId: string; postId: string };
    const body = z.object({
      reaction: z.string().min(1),
      visibility: z.enum(['public', 'cohort', 'dm']).default('public'),
    }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    await pool.query(
      `INSERT INTO post_reactions (post_id, user_id, reaction, visibility) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [postId, request.user.sub, body.data.reaction, body.data.visibility]
    );
    return reply.status(201).send({ post_id: postId, reaction: body.data.reaction });
  });

  fastify.delete('/:id/threads/:threadId/posts/:postId/reactions/:reaction', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { postId, reaction } = request.params as { id: string; threadId: string; postId: string; reaction: string };
    await pool.query(
      `DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND reaction = $3`,
      [postId, request.user.sub, reaction]
    );
    return reply.status(204).send();
  });
}
