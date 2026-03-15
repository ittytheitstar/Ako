import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const issueCreateSchema = z.object({
  course_id: z.string().uuid(),
  board_id: z.string().uuid().optional(),
  user_story_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['bug', 'feature', 'improvement', 'task', 'question']).optional().default('task'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  assignees: z.array(z.string().uuid()).optional().default([]),
  labels: z.array(z.string()).optional().default([]),
  due_date: z.string().optional(),
});

const issueUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(['bug', 'feature', 'improvement', 'task', 'question']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'wont_fix']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignees: z.array(z.string().uuid()).optional(),
  labels: z.array(z.string()).optional(),
  due_date: z.string().optional().nullable(),
  user_story_id: z.string().uuid().optional().nullable(),
  board_id: z.string().uuid().optional().nullable(),
});

const commentCreateSchema = z.object({
  body: z.string().min(1),
});

const commentUpdateSchema = z.object({
  body: z.string().min(1),
});

const storyCreateSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().min(1),
  as_a: z.string().optional(),
  i_want: z.string().optional(),
  so_that: z.string().optional(),
  acceptance_criteria: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  story_points: z.number().int().optional(),
  assignees: z.array(z.string().uuid()).optional().default([]),
  labels: z.array(z.string()).optional().default([]),
  competency_id: z.string().uuid().optional(),
});

const storyUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  as_a: z.string().optional(),
  i_want: z.string().optional(),
  so_that: z.string().optional(),
  acceptance_criteria: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['draft', 'ready', 'in_progress', 'done', 'rejected']).optional(),
  story_points: z.number().int().optional().nullable(),
  assignees: z.array(z.string().uuid()).optional(),
  labels: z.array(z.string()).optional(),
  competency_id: z.string().uuid().optional().nullable(),
});

// ─── Issue Routes ─────────────────────────────────────────────────────────────

export async function issueRoutes(fastify: FastifyInstance) {
  // List issues
  fastify.get('/', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Issues'],
      summary: 'List issues',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          course_id: { type: 'string' },
          status: { type: 'string' },
          type: { type: 'string' },
          assignee: { type: 'string' },
          board_id: { type: 'string' },
          user_story_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const q = request.query as Record<string, string>;
    const conditions: string[] = ['i.tenant_id = $1'];
    const params: unknown[] = [request.tenantId];
    let idx = 2;

    if (q.course_id)    { conditions.push(`i.course_id = $${idx++}`);    params.push(q.course_id); }
    if (q.status)       { conditions.push(`i.status = $${idx++}`);       params.push(q.status); }
    if (q.type)         { conditions.push(`i.type = $${idx++}`);         params.push(q.type); }
    if (q.board_id)     { conditions.push(`i.board_id = $${idx++}`);     params.push(q.board_id); }
    if (q.user_story_id){ conditions.push(`i.user_story_id = $${idx++}`); params.push(q.user_story_id); }
    if (q.assignee)     { conditions.push(`$${idx++} = ANY(i.assignees)`); params.push(q.assignee); }

    const { rows } = await pool.query(
      `SELECT i.*,
              u.display_name AS reporter_name,
              (SELECT COUNT(*) FROM issue_comments ic WHERE ic.issue_id = i.issue_id) AS comment_count
       FROM issues i
       LEFT JOIN users u ON u.user_id = i.reporter_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY i.created_at DESC`,
      params
    );
    return reply.send({ data: rows });
  });

  // Create issue
  fastify.post('/', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Issues'], summary: 'Create an issue', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const body = issueCreateSchema.parse(request.body);
    const { rows } = await pool.query(
      `INSERT INTO issues
         (tenant_id, course_id, board_id, user_story_id, title, description, type, priority,
          reporter_id, assignees, labels, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [request.tenantId, body.course_id, body.board_id ?? null, body.user_story_id ?? null,
       body.title, body.description ?? null, body.type, body.priority,
       request.user.sub, body.assignees, body.labels, body.due_date ?? null]
    );
    return reply.status(201).send(rows[0]);
  });

  // Get issue with comments
  fastify.get('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Issues'], summary: 'Get issue detail', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT i.*, u.display_name AS reporter_name, s.title AS user_story_title
       FROM issues i
       LEFT JOIN users u ON u.user_id = i.reporter_id
       LEFT JOIN user_stories s ON s.story_id = i.user_story_id
       WHERE i.issue_id = $1 AND i.tenant_id = $2`,
      [id, request.tenantId]
    );
    if (!rows[0]) throw NotFound('Issue not found');
    const { rows: comments } = await pool.query(
      `SELECT c.*, u.display_name AS user_display_name
       FROM issue_comments c
       JOIN users u ON u.user_id = c.user_id
       WHERE c.issue_id = $1
       ORDER BY c.created_at`,
      [id]
    );
    return reply.send({ ...rows[0], comments });
  });

  // Update issue
  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Issues'], summary: 'Update an issue', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = issueUpdateSchema.parse(request.body);
    const sets: string[] = [];
    const params: unknown[] = [id, request.tenantId];
    let idx = 3;
    const add = (col: string, val: unknown) => { sets.push(`${col} = $${idx++}`); params.push(val); };
    if (body.title !== undefined)        add('title', body.title);
    if (body.description !== undefined)  add('description', body.description);
    if (body.type !== undefined)         add('type', body.type);
    if (body.priority !== undefined)     add('priority', body.priority);
    if (body.assignees !== undefined)    add('assignees', body.assignees);
    if (body.labels !== undefined)       add('labels', body.labels);
    if (body.due_date !== undefined)     add('due_date', body.due_date);
    if (body.user_story_id !== undefined) add('user_story_id', body.user_story_id);
    if (body.board_id !== undefined)     add('board_id', body.board_id);
    if (body.status !== undefined) {
      add('status', body.status);
      if (body.status === 'resolved' || body.status === 'closed') {
        sets.push(`resolved_at = COALESCE(resolved_at, now())`);
      } else if (body.status === 'open' || body.status === 'in_progress') {
        add('resolved_at', null);
      }
    }
    if (!sets.length) throw BadRequest('Nothing to update');
    sets.push('updated_at = now()');
    const { rows } = await pool.query(
      `UPDATE issues SET ${sets.join(', ')} WHERE issue_id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    if (!rows[0]) throw NotFound('Issue not found');
    return reply.send(rows[0]);
  });

  // Delete issue
  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Issues'], summary: 'Delete an issue', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM issues WHERE issue_id = $1 AND tenant_id = $2`, [id, request.tenantId]);
    return reply.status(204).send();
  });

  // List comments
  fastify.get('/:id/comments', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Issues'], summary: 'List issue comments', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT c.*, u.display_name AS user_display_name
       FROM issue_comments c
       JOIN users u ON u.user_id = c.user_id
       WHERE c.issue_id = $1 AND c.tenant_id = $2
       ORDER BY c.created_at`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Add comment
  fastify.post('/:id/comments', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Issues'], summary: 'Add a comment to an issue', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { body: commentBody } = commentCreateSchema.parse(request.body);
    const { rows } = await pool.query(
      `INSERT INTO issue_comments (issue_id, tenant_id, user_id, body)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, request.tenantId, request.user.sub, commentBody]
    );
    return reply.status(201).send(rows[0]);
  });
}

// ─── Issue Comment CRUD Routes ─────────────────────────────────────────────────

export async function issueCommentRoutes(fastify: FastifyInstance) {
  // Update comment
  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Issues'], summary: 'Update a comment', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { body: commentBody } = commentUpdateSchema.parse(request.body);
    const { rows } = await pool.query(
      `UPDATE issue_comments SET body = $1, updated_at = now()
       WHERE comment_id = $2 AND tenant_id = $3 RETURNING *`,
      [commentBody, id, request.tenantId]
    );
    if (!rows[0]) throw NotFound('Comment not found');
    return reply.send(rows[0]);
  });

  // Delete comment
  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Issues'], summary: 'Delete a comment', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM issue_comments WHERE comment_id = $1 AND tenant_id = $2`, [id, request.tenantId]);
    return reply.status(204).send();
  });
}

// ─── User Story Routes ────────────────────────────────────────────────────────

export async function userStoryRoutes(fastify: FastifyInstance) {
  // List user stories
  fastify.get('/', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['User Stories'],
      summary: 'List user stories',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          course_id: { type: 'string' },
          status: { type: 'string' },
          assignee: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const q = request.query as Record<string, string>;
    const conditions: string[] = ['s.tenant_id = $1'];
    const params: unknown[] = [request.tenantId];
    let idx = 2;

    if (q.course_id) { conditions.push(`s.course_id = $${idx++}`); params.push(q.course_id); }
    if (q.status)    { conditions.push(`s.status = $${idx++}`);    params.push(q.status); }
    if (q.assignee)  { conditions.push(`$${idx++} = ANY(s.assignees)`); params.push(q.assignee); }

    const { rows } = await pool.query(
      `SELECT s.*,
              comp.short_name AS competency_short_name,
              (SELECT COUNT(*) FROM issues i WHERE i.user_story_id = s.story_id) AS issue_count,
              (SELECT COUNT(*) FROM kanban_cards c WHERE c.user_story_id = s.story_id AND NOT c.archived) AS card_count
       FROM user_stories s
       LEFT JOIN competencies comp ON comp.competency_id = s.competency_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC`,
      params
    );
    return reply.send({ data: rows });
  });

  // Create user story
  fastify.post('/', {
    preHandler: fastify.authenticate,
    schema: { tags: ['User Stories'], summary: 'Create a user story', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const body = storyCreateSchema.parse(request.body);
    const { rows } = await pool.query(
      `INSERT INTO user_stories
         (tenant_id, course_id, title, as_a, i_want, so_that, acceptance_criteria,
          priority, story_points, assignees, labels, competency_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [request.tenantId, body.course_id, body.title, body.as_a ?? null, body.i_want ?? null,
       body.so_that ?? null, body.acceptance_criteria ?? null, body.priority,
       body.story_points ?? null, body.assignees, body.labels,
       body.competency_id ?? null, request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  // Get user story with linked issues and cards
  fastify.get('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['User Stories'], summary: 'Get user story detail', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT s.*, comp.short_name AS competency_short_name
       FROM user_stories s
       LEFT JOIN competencies comp ON comp.competency_id = s.competency_id
       WHERE s.story_id = $1 AND s.tenant_id = $2`,
      [id, request.tenantId]
    );
    if (!rows[0]) throw NotFound('User story not found');

    const { rows: issues } = await pool.query(
      `SELECT issue_id, title, status, type, priority FROM issues WHERE user_story_id = $1`,
      [id]
    );
    const { rows: cards } = await pool.query(
      `SELECT card_id, title, priority, archived FROM kanban_cards WHERE user_story_id = $1`,
      [id]
    );

    return reply.send({ ...rows[0], issues, cards });
  });

  // Update user story
  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['User Stories'], summary: 'Update a user story', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = storyUpdateSchema.parse(request.body);
    const sets: string[] = [];
    const params: unknown[] = [id, request.tenantId];
    let idx = 3;
    const add = (col: string, val: unknown) => { sets.push(`${col} = $${idx++}`); params.push(val); };
    if (body.title !== undefined)               add('title', body.title);
    if (body.as_a !== undefined)                add('as_a', body.as_a);
    if (body.i_want !== undefined)              add('i_want', body.i_want);
    if (body.so_that !== undefined)             add('so_that', body.so_that);
    if (body.acceptance_criteria !== undefined) add('acceptance_criteria', body.acceptance_criteria);
    if (body.priority !== undefined)            add('priority', body.priority);
    if (body.status !== undefined)              add('status', body.status);
    if (body.story_points !== undefined)        add('story_points', body.story_points);
    if (body.assignees !== undefined)           add('assignees', body.assignees);
    if (body.labels !== undefined)              add('labels', body.labels);
    if (body.competency_id !== undefined)       add('competency_id', body.competency_id);
    if (!sets.length) throw BadRequest('Nothing to update');
    sets.push('updated_at = now()');
    const { rows } = await pool.query(
      `UPDATE user_stories SET ${sets.join(', ')} WHERE story_id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    if (!rows[0]) throw NotFound('User story not found');
    return reply.send(rows[0]);
  });

  // Delete user story
  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['User Stories'], summary: 'Delete a user story', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM user_stories WHERE story_id = $1 AND tenant_id = $2`, [id, request.tenantId]);
    return reply.status(204).send();
  });
}
