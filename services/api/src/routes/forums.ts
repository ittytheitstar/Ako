import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const forumSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().min(1),
  settings: z.record(z.unknown()).default({}),
});

const threadSchema = z.object({
  title: z.string().min(1),
});

const postSchema = z.object({
  body: z.record(z.unknown()),
  parent_post_id: z.string().uuid().optional(),
});

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
      `INSERT INTO forums (tenant_id, course_id, title, settings) VALUES ($1, $2, $3, $4) RETURNING *`,
      [request.tenantId, body.data.course_id, body.data.title, JSON.stringify(body.data.settings)]
    );
    return reply.status(201).send(rows[0]);
  });

  // Threads
  fastify.get('/:id/threads', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM forum_threads WHERE forum_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
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
    return reply.status(201).send(rows[0]);
  });

  // Posts
  fastify.get('/:id/threads/:threadId/posts', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { threadId } = request.params as { id: string; threadId: string };
    const { rows } = await pool.query(
      `SELECT * FROM forum_posts WHERE thread_id = $1 AND tenant_id = $2 AND deleted_at IS NULL ORDER BY created_at`,
      [threadId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/threads/:threadId/posts', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { threadId } = request.params as { id: string; threadId: string };
    const body = postSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO forum_posts (tenant_id, thread_id, author_id, body, parent_post_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request.tenantId, threadId, request.user.sub, JSON.stringify(body.data.body), body.data.parent_post_id]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id/threads/:threadId/posts/:postId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { threadId, postId } = request.params as { id: string; threadId: string; postId: string };
    const body = postSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    if (!body.data.body) throw BadRequest('body is required');
    const { rows } = await pool.query(
      `UPDATE forum_posts SET body = $1, updated_at = now()
       WHERE post_id = $2 AND thread_id = $3 AND author_id = $4 AND tenant_id = $5 RETURNING *`,
      [JSON.stringify(body.data.body), postId, threadId, request.user.sub, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Post not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id/threads/:threadId/posts/:postId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { threadId, postId } = request.params as { id: string; threadId: string; postId: string };
    const { rowCount } = await pool.query(
      `UPDATE forum_posts SET deleted_at = now() WHERE post_id = $1 AND thread_id = $2 AND tenant_id = $3`,
      [postId, threadId, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Post not found');
    return reply.status(204).send();
  });

  // Reactions — post_reactions PK is (post_id, user_id, reaction, visibility, scope_id); no tenant_id column
  fastify.post('/:id/threads/:threadId/posts/:postId/reactions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { postId } = request.params as { id: string; threadId: string; postId: string };
    const body = z.object({ reaction: z.string().min(1) }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    await pool.query(
      `INSERT INTO post_reactions (post_id, user_id, reaction, visibility) VALUES ($1, $2, $3, 'public') ON CONFLICT DO NOTHING`,
      [postId, request.user.sub, body.data.reaction]
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
