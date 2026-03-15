import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const boardCreateSchema = z.object({
  course_id: z.string().uuid(),
  cohort_id: z.string().uuid().optional(),
  owner_user_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  template_id: z.string().uuid().optional(),
  settings: z.record(z.unknown()).optional().default({}),
});

const boardUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

const laneCreateSchema = z.object({
  title: z.string().min(1),
  color: z.string().optional().default('#6366f1'),
  wip_limit: z.number().int().min(0).optional().default(0),
  is_done_lane: z.boolean().optional().default(false),
  position: z.number().int().optional(),
});

const laneUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  color: z.string().optional(),
  wip_limit: z.number().int().min(0).optional(),
  is_done_lane: z.boolean().optional(),
  position: z.number().int().optional(),
});

const reorderLanesSchema = z.object({
  lane_ids: z.array(z.string().uuid()),
});

const cardCreateSchema = z.object({
  lane_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  assignees: z.array(z.string().uuid()).optional().default([]),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  flags: z.array(z.string()).optional().default([]),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  story_points: z.number().int().optional(),
  issue_id: z.string().uuid().optional(),
  user_story_id: z.string().uuid().optional(),
});

const cardUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assignees: z.array(z.string().uuid()).optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  flags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  story_points: z.number().int().optional().nullable(),
  issue_id: z.string().uuid().optional().nullable(),
  user_story_id: z.string().uuid().optional().nullable(),
});

const cardMoveSchema = z.object({
  lane_id: z.string().uuid(),
  position: z.number().int().optional().default(0),
  force: z.boolean().optional().default(false),
});

const timeLogCreateSchema = z.object({
  minutes: z.number().int().min(1),
  note: z.string().optional(),
  logged_at: z.string().optional(),
});

const memberAddSchema = z.object({
  user_id: z.string().uuid(),
  board_role: z.enum(['viewer', 'contributor', 'member', 'manager', 'admin']).optional().default('contributor'),
});

const memberUpdateSchema = z.object({
  board_role: z.enum(['viewer', 'contributor', 'member', 'manager', 'admin']),
});

const refreshSchema = z.object({
  course_id: z.string().uuid(),
  cohort_id: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
});

const templateCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  lane_definitions: z.array(z.object({
    title: z.string().min(1),
    color: z.string().optional().default('#6366f1'),
    wip_limit: z.number().int().min(0).optional().default(0),
    is_done_lane: z.boolean().optional().default(false),
  })).optional().default([]),
  seed_cards: z.array(z.unknown()).optional().default([]),
});

const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  lane_definitions: z.array(z.object({
    title: z.string().min(1),
    color: z.string().optional(),
    wip_limit: z.number().int().min(0).optional(),
    is_done_lane: z.boolean().optional(),
  })).optional(),
  seed_cards: z.array(z.unknown()).optional(),
});

const instantiateSchema = z.object({
  course_id: z.string().uuid(),
  cohort_id: z.string().uuid().optional(),
  user_ids: z.array(z.string().uuid()).optional(),
  title_pattern: z.string().optional().default('{display_name} – {template_name}'),
});

// ─── Board Routes ─────────────────────────────────────────────────────────────

export async function kanbanBoardRoutes(fastify: FastifyInstance) {
  // List boards
  fastify.get('/', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Kanban'],
      summary: 'List kanban boards',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          course_id: { type: 'string' },
          status: { type: 'string' },
          owner_user_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { course_id, status, owner_user_id } = request.query as Record<string, string>;
    const conditions: string[] = ['b.tenant_id = $1'];
    const params: unknown[] = [request.tenantId];
    let idx = 2;

    if (course_id) { conditions.push(`b.course_id = $${idx++}`); params.push(course_id); }
    if (status)    { conditions.push(`b.status = $${idx++}`);    params.push(status); }
    if (owner_user_id) { conditions.push(`b.owner_user_id = $${idx++}`); params.push(owner_user_id); }
    if (!status)   conditions.push(`b.status = 'active'`);

    const { rows } = await pool.query(
      `SELECT b.*,
              u.display_name AS owner_display_name,
              (SELECT COUNT(*) FROM kanban_lanes l WHERE l.board_id = b.board_id)  AS lane_count,
              (SELECT COUNT(*) FROM kanban_cards  c WHERE c.board_id = b.board_id AND NOT c.archived) AS card_count
       FROM kanban_boards b
       LEFT JOIN users u ON u.user_id = b.owner_user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.created_at DESC`,
      params
    );
    return reply.send({ data: rows });
  });

  // Create board
  fastify.post('/', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Create kanban board', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const body = boardCreateSchema.parse(request.body);
    const { rows } = await pool.query(
      `INSERT INTO kanban_boards (tenant_id, course_id, cohort_id, owner_user_id, title, description, template_id, settings, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [request.tenantId, body.course_id, body.cohort_id ?? null, body.owner_user_id ?? null,
       body.title, body.description ?? null, body.template_id ?? null,
       JSON.stringify(body.settings), request.user.sub]
    );
    const board = rows[0];

    // If template_id is provided, clone lane definitions
    if (body.template_id) {
      const { rows: tmplRows } = await pool.query(
        `SELECT lane_definitions FROM kanban_board_templates WHERE template_id = $1 AND tenant_id = $2`,
        [body.template_id, request.tenantId]
      );
      if (tmplRows[0]?.lane_definitions) {
        const defs = Array.isArray(tmplRows[0].lane_definitions) ? tmplRows[0].lane_definitions : [];
        for (let i = 0; i < defs.length; i++) {
          const d = defs[i];
          await pool.query(
            `INSERT INTO kanban_lanes (board_id, tenant_id, title, position, color, wip_limit, is_done_lane)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [board.board_id, request.tenantId, d.title, i, d.color ?? '#6366f1', d.wip_limit ?? 0, d.is_done_lane ?? false]
          );
        }
      }
    } else {
      // Create default lanes
      const defaultLanes = ['Backlog', 'In Progress', 'Review', 'Done'];
      for (let i = 0; i < defaultLanes.length; i++) {
        await pool.query(
          `INSERT INTO kanban_lanes (board_id, tenant_id, title, position, is_done_lane)
           VALUES ($1,$2,$3,$4,$5)`,
          [board.board_id, request.tenantId, defaultLanes[i], i, i === defaultLanes.length - 1]
        );
      }
    }

    return reply.status(201).send(board);
  });

  // Get board
  fastify.get('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Get kanban board with lanes and cards', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT b.*, u.display_name AS owner_display_name
       FROM kanban_boards b
       LEFT JOIN users u ON u.user_id = b.owner_user_id
       WHERE b.board_id = $1 AND b.tenant_id = $2`,
      [id, request.tenantId]
    );
    if (!rows[0]) throw NotFound('Board not found');

    const { rows: lanes } = await pool.query(
      `SELECT l.*, COUNT(c.card_id) FILTER (WHERE NOT c.archived) AS card_count
       FROM kanban_lanes l
       LEFT JOIN kanban_cards c ON c.lane_id = l.lane_id
       WHERE l.board_id = $1
       GROUP BY l.lane_id
       ORDER BY l.position`,
      [id]
    );
    const { rows: cards } = await pool.query(
      `SELECT * FROM kanban_cards WHERE board_id = $1 AND NOT archived ORDER BY lane_id, position`,
      [id]
    );

    return reply.send({ ...rows[0], lanes, cards });
  });

  // Update board
  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Update kanban board', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = boardUpdateSchema.parse(request.body);
    const sets: string[] = [];
    const params: unknown[] = [id, request.tenantId];
    let idx = 3;
    if (body.title !== undefined)       { sets.push(`title = $${idx++}`);       params.push(body.title); }
    if (body.description !== undefined) { sets.push(`description = $${idx++}`); params.push(body.description); }
    if (body.settings !== undefined)    { sets.push(`settings = $${idx++}`);    params.push(JSON.stringify(body.settings)); }
    if (!sets.length) throw BadRequest('Nothing to update');
    sets.push(`updated_at = now()`);
    const { rows } = await pool.query(
      `UPDATE kanban_boards SET ${sets.join(', ')} WHERE board_id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    if (!rows[0]) throw NotFound('Board not found');
    return reply.send(rows[0]);
  });

  // Archive board
  fastify.post('/:id/archive', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Archive a board', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `UPDATE kanban_boards SET status = 'archived', archived_at = now(), updated_at = now()
       WHERE board_id = $1 AND tenant_id = $2 RETURNING *`,
      [id, request.tenantId]
    );
    if (!rows[0]) throw NotFound('Board not found');
    return reply.send(rows[0]);
  });

  // Refresh board (clone lane structure to new board)
  fastify.post('/:id/refresh', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Clone lane structure to a new board', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = refreshSchema.parse(request.body);
    const { rows: src } = await pool.query(
      `SELECT * FROM kanban_boards WHERE board_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (!src[0]) throw NotFound('Board not found');
    const source = src[0];
    const { rows: newBoard } = await pool.query(
      `INSERT INTO kanban_boards (tenant_id, course_id, cohort_id, owner_user_id, title, description, template_id, settings, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [request.tenantId, body.course_id, body.cohort_id ?? source.cohort_id,
       source.owner_user_id, body.title ?? source.title,
       source.description, source.template_id, source.settings, request.user.sub]
    );
    const { rows: lanes } = await pool.query(
      `SELECT * FROM kanban_lanes WHERE board_id = $1 ORDER BY position`, [id]
    );
    for (const lane of lanes) {
      await pool.query(
        `INSERT INTO kanban_lanes (board_id, tenant_id, title, position, color, wip_limit, is_done_lane)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [newBoard[0].board_id, request.tenantId, lane.title, lane.position, lane.color, lane.wip_limit, lane.is_done_lane]
      );
    }
    return reply.status(201).send(newBoard[0]);
  });

  // Delete board
  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Delete a board', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM kanban_boards WHERE board_id = $1 AND tenant_id = $2`, [id, request.tenantId]);
    return reply.status(204).send();
  });
}

// ─── Lane Routes ─────────────────────────────────────────────────────────────

export async function kanbanLaneRoutes(fastify: FastifyInstance) {
  // List lanes for a board
  fastify.get('/:boardId/lanes', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'List lanes for a board', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const { rows } = await pool.query(
      `SELECT l.*, COUNT(c.card_id) FILTER (WHERE NOT c.archived) AS card_count
       FROM kanban_lanes l
       LEFT JOIN kanban_cards c ON c.lane_id = l.lane_id
       WHERE l.board_id = $1 AND l.tenant_id = $2
       GROUP BY l.lane_id
       ORDER BY l.position`,
      [boardId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Create lane
  fastify.post('/:boardId/lanes', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Add a lane to a board', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const body = laneCreateSchema.parse(request.body);
    const { rows: max } = await pool.query(
      `SELECT COALESCE(MAX(position), -1) AS max_pos FROM kanban_lanes WHERE board_id = $1`, [boardId]
    );
    const pos = body.position ?? (Number(max[0].max_pos) + 1);
    const { rows } = await pool.query(
      `INSERT INTO kanban_lanes (board_id, tenant_id, title, position, color, wip_limit, is_done_lane)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [boardId, request.tenantId, body.title, pos, body.color, body.wip_limit, body.is_done_lane]
    );
    return reply.status(201).send(rows[0]);
  });

  // Reorder lanes
  fastify.put('/:boardId/lanes/reorder', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Reorder lanes', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const { lane_ids } = reorderLanesSchema.parse(request.body);
    for (let i = 0; i < lane_ids.length; i++) {
      await pool.query(
        `UPDATE kanban_lanes SET position = $1 WHERE lane_id = $2 AND board_id = $3`,
        [i, lane_ids[i], boardId]
      );
    }
    const { rows } = await pool.query(
      `SELECT * FROM kanban_lanes WHERE board_id = $1 ORDER BY position`, [boardId]
    );
    return reply.send({ data: rows });
  });
}

export async function kanbanLaneCrudRoutes(fastify: FastifyInstance) {
  // Update lane
  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Update a lane', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = laneUpdateSchema.parse(request.body);
    const sets: string[] = [];
    const params: unknown[] = [id, request.tenantId];
    let idx = 3;
    if (body.title !== undefined)        { sets.push(`title = $${idx++}`);        params.push(body.title); }
    if (body.color !== undefined)        { sets.push(`color = $${idx++}`);        params.push(body.color); }
    if (body.wip_limit !== undefined)    { sets.push(`wip_limit = $${idx++}`);    params.push(body.wip_limit); }
    if (body.is_done_lane !== undefined) { sets.push(`is_done_lane = $${idx++}`); params.push(body.is_done_lane); }
    if (body.position !== undefined)     { sets.push(`position = $${idx++}`);     params.push(body.position); }
    if (!sets.length) throw BadRequest('Nothing to update');
    sets.push(`updated_at = now()`);
    const { rows } = await pool.query(
      `UPDATE kanban_lanes SET ${sets.join(', ')} WHERE lane_id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    if (!rows[0]) throw NotFound('Lane not found');
    return reply.send(rows[0]);
  });

  // Delete lane
  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Delete a lane (must be empty)', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows: cards } = await pool.query(
      `SELECT card_id FROM kanban_cards WHERE lane_id = $1 AND NOT archived LIMIT 1`, [id]
    );
    if (cards.length) throw BadRequest('Cannot delete a lane that still has active cards');
    await pool.query(`DELETE FROM kanban_lanes WHERE lane_id = $1 AND tenant_id = $2`, [id, request.tenantId]);
    return reply.status(204).send();
  });
}

// ─── Card Routes ─────────────────────────────────────────────────────────────

export async function kanbanCardRoutes(fastify: FastifyInstance) {
  // List cards on a board
  fastify.get('/:boardId/cards', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'List all cards on a board', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const { rows } = await pool.query(
      `SELECT * FROM kanban_cards WHERE board_id = $1 AND tenant_id = $2 ORDER BY lane_id, position`,
      [boardId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Create card
  fastify.post('/:boardId/cards', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Create a card', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const body = cardCreateSchema.parse(request.body);

    // Check WIP limit
    const { rows: lane } = await pool.query(
      `SELECT wip_limit FROM kanban_lanes WHERE lane_id = $1`, [body.lane_id]
    );
    if (lane[0]?.wip_limit > 0) {
      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*) AS n FROM kanban_cards WHERE lane_id = $1 AND NOT archived`, [body.lane_id]
      );
      if (Number(cnt[0].n) >= lane[0].wip_limit) {
        return reply.status(422).send({
          type: 'https://ako.invalid/errors/wip_limit_exceeded',
          title: 'WIP Limit Exceeded',
          status: 422,
          detail: 'This lane has reached its WIP limit. Pass force:true to override.',
        });
      }
    }

    const { rows: maxPos } = await pool.query(
      `SELECT COALESCE(MAX(position), -1) AS max_pos FROM kanban_cards WHERE lane_id = $1 AND NOT archived`,
      [body.lane_id]
    );
    const pos = Number(maxPos[0].max_pos) + 1;

    const { rows } = await pool.query(
      `INSERT INTO kanban_cards
         (board_id, lane_id, tenant_id, title, description, assignees, start_date, end_date,
          tags, flags, position, priority, story_points, issue_id, user_story_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [boardId, body.lane_id, request.tenantId, body.title, body.description ?? null,
       body.assignees, body.start_date ?? null, body.end_date ?? null,
       body.tags, body.flags, pos, body.priority,
       body.story_points ?? null, body.issue_id ?? null, body.user_story_id ?? null, request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });
}

export async function kanbanCardCrudRoutes(fastify: FastifyInstance) {
  // Get card
  fastify.get('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Get card detail', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT c.*, COALESCE(tl.total_minutes, 0) AS time_worked_minutes_actual
       FROM kanban_cards c
       LEFT JOIN (
         SELECT card_id, SUM(minutes) AS total_minutes FROM kanban_card_time_logs GROUP BY card_id
       ) tl ON tl.card_id = c.card_id
       WHERE c.card_id = $1 AND c.tenant_id = $2`,
      [id, request.tenantId]
    );
    if (!rows[0]) throw NotFound('Card not found');
    return reply.send(rows[0]);
  });

  // Update card
  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Update a card', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = cardUpdateSchema.parse(request.body);
    const sets: string[] = [];
    const params: unknown[] = [id, request.tenantId];
    let idx = 3;
    const add = (col: string, val: unknown) => { sets.push(`${col} = $${idx++}`); params.push(val); };
    if (body.title !== undefined)        add('title', body.title);
    if (body.description !== undefined)  add('description', body.description);
    if (body.assignees !== undefined)    add('assignees', body.assignees);
    if (body.start_date !== undefined)   add('start_date', body.start_date);
    if (body.end_date !== undefined)     add('end_date', body.end_date);
    if (body.tags !== undefined)         add('tags', body.tags);
    if (body.flags !== undefined)        add('flags', body.flags);
    if (body.priority !== undefined)     add('priority', body.priority);
    if (body.story_points !== undefined) add('story_points', body.story_points);
    if (body.issue_id !== undefined)     add('issue_id', body.issue_id);
    if (body.user_story_id !== undefined) add('user_story_id', body.user_story_id);
    if (!sets.length) throw BadRequest('Nothing to update');
    sets.push('updated_at = now()');
    const { rows } = await pool.query(
      `UPDATE kanban_cards SET ${sets.join(', ')} WHERE card_id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    if (!rows[0]) throw NotFound('Card not found');
    return reply.send(rows[0]);
  });

  // Move card
  fastify.post('/:id/move', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Move card to a different lane', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { lane_id, position, force } = cardMoveSchema.parse(request.body);

    const { rows: laneRow } = await pool.query(
      `SELECT wip_limit, is_done_lane FROM kanban_lanes WHERE lane_id = $1`, [lane_id]
    );
    if (!laneRow[0]) throw NotFound('Lane not found');

    // WIP limit check (exclude the card being moved from the target lane count)
    if (!force && laneRow[0].wip_limit > 0) {
      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*) AS n FROM kanban_cards WHERE lane_id = $1 AND card_id != $2 AND NOT archived`,
        [lane_id, id]
      );
      if (Number(cnt[0].n) >= laneRow[0].wip_limit) {
        return reply.status(422).send({
          type: 'https://ako.invalid/errors/wip_limit_exceeded',
          title: 'WIP Limit Exceeded',
          status: 422,
          detail: 'This lane has reached its WIP limit. Pass force:true to override.',
        });
      }
    }

    const { rows } = await pool.query(
      `UPDATE kanban_cards SET lane_id = $1, position = $2, updated_at = now()
       WHERE card_id = $3 AND tenant_id = $4 RETURNING *`,
      [lane_id, position, id, request.tenantId]
    );
    if (!rows[0]) throw NotFound('Card not found');
    return reply.send(rows[0]);
  });

  // Archive card
  fastify.post('/:id/archive', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Archive a card', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `UPDATE kanban_cards SET archived = true, updated_at = now()
       WHERE card_id = $1 AND tenant_id = $2 RETURNING *`,
      [id, request.tenantId]
    );
    if (!rows[0]) throw NotFound('Card not found');
    return reply.send(rows[0]);
  });

  // Delete card
  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Delete a card', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM kanban_cards WHERE card_id = $1 AND tenant_id = $2`, [id, request.tenantId]);
    return reply.status(204).send();
  });

  // Log time on card
  fastify.post('/:id/time-log', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Log time on a card', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = timeLogCreateSchema.parse(request.body);
    const { rows } = await pool.query(
      `INSERT INTO kanban_card_time_logs (card_id, tenant_id, user_id, minutes, note, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, request.tenantId, request.user.sub, body.minutes, body.note ?? null, body.logged_at ?? new Date().toISOString()]
    );
    // Update cumulative time on card
    await pool.query(
      `UPDATE kanban_cards SET time_worked_minutes = time_worked_minutes + $1, updated_at = now()
       WHERE card_id = $2`,
      [body.minutes, id]
    );
    return reply.status(201).send(rows[0]);
  });

  // Get time logs for card
  fastify.get('/:id/time-logs', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Get time logs for a card', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT tl.*, u.display_name AS user_display_name
       FROM kanban_card_time_logs tl
       LEFT JOIN users u ON u.user_id = tl.user_id
       WHERE tl.card_id = $1 AND tl.tenant_id = $2
       ORDER BY tl.logged_at DESC`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });
}

// ─── Board Member Routes ───────────────────────────────────────────────────────

export async function kanbanMemberRoutes(fastify: FastifyInstance) {
  // List members
  fastify.get('/:boardId/members', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'List board members', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const { rows } = await pool.query(
      `SELECT m.*, u.display_name AS user_display_name
       FROM kanban_board_members m
       JOIN users u ON u.user_id = m.user_id
       WHERE m.board_id = $1 AND m.tenant_id = $2
       ORDER BY m.added_at`,
      [boardId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Add member
  fastify.post('/:boardId/members', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Add a board member', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const body = memberAddSchema.parse(request.body);
    const { rows } = await pool.query(
      `INSERT INTO kanban_board_members (board_id, tenant_id, user_id, board_role, added_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (board_id, user_id) DO UPDATE SET board_role = EXCLUDED.board_role
       RETURNING *`,
      [boardId, request.tenantId, body.user_id, body.board_role, request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });
}

export async function kanbanMemberCrudRoutes(fastify: FastifyInstance) {
  // Update member role
  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Update board member role', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { board_role } = memberUpdateSchema.parse(request.body);
    const { rows } = await pool.query(
      `UPDATE kanban_board_members SET board_role = $1 WHERE member_id = $2 AND tenant_id = $3 RETURNING *`,
      [board_role, id, request.tenantId]
    );
    if (!rows[0]) throw NotFound('Member not found');
    return reply.send(rows[0]);
  });

  // Remove member
  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Remove a board member', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM kanban_board_members WHERE member_id = $1 AND tenant_id = $2`, [id, request.tenantId]);
    return reply.status(204).send();
  });
}

// ─── Board Template Routes ─────────────────────────────────────────────────────

export async function kanbanTemplateRoutes(fastify: FastifyInstance) {
  // List templates
  fastify.get('/', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'List board templates', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM kanban_board_templates WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Create template
  fastify.post('/', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Create a board template', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const body = templateCreateSchema.parse(request.body);
    const { rows } = await pool.query(
      `INSERT INTO kanban_board_templates (tenant_id, name, description, lane_definitions, seed_cards, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [request.tenantId, body.name, body.description ?? null,
       JSON.stringify(body.lane_definitions), JSON.stringify(body.seed_cards), request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  // Get template
  fastify.get('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Get board template', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM kanban_board_templates WHERE template_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (!rows[0]) throw NotFound('Template not found');
    return reply.send(rows[0]);
  });

  // Update template
  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Update a board template', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = templateUpdateSchema.parse(request.body);
    const sets: string[] = [];
    const params: unknown[] = [id, request.tenantId];
    let idx = 3;
    if (body.name !== undefined)             { sets.push(`name = $${idx++}`);             params.push(body.name); }
    if (body.description !== undefined)      { sets.push(`description = $${idx++}`);      params.push(body.description); }
    if (body.lane_definitions !== undefined) { sets.push(`lane_definitions = $${idx++}`); params.push(JSON.stringify(body.lane_definitions)); }
    if (body.seed_cards !== undefined)       { sets.push(`seed_cards = $${idx++}`);       params.push(JSON.stringify(body.seed_cards)); }
    if (!sets.length) throw BadRequest('Nothing to update');
    sets.push('updated_at = now()');
    const { rows } = await pool.query(
      `UPDATE kanban_board_templates SET ${sets.join(', ')} WHERE template_id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    if (!rows[0]) throw NotFound('Template not found');
    return reply.send(rows[0]);
  });

  // Delete template
  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Delete a board template', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM kanban_board_templates WHERE template_id = $1 AND tenant_id = $2`, [id, request.tenantId]);
    return reply.status(204).send();
  });

  // Instantiate template for multiple users
  fastify.post('/:id/instantiate', {
    preHandler: fastify.authenticate,
    schema: { tags: ['Kanban'], summary: 'Mass-create boards from template', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = instantiateSchema.parse(request.body);

    const { rows: tmpl } = await pool.query(
      `SELECT * FROM kanban_board_templates WHERE template_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (!tmpl[0]) throw NotFound('Template not found');
    const template = tmpl[0];

    let userIds: string[] = body.user_ids ?? [];
    if (!userIds.length && body.cohort_id) {
      const { rows: members } = await pool.query(
        `SELECT user_id FROM cohort_members WHERE cohort_id = $1`, [body.cohort_id]
      );
      userIds = members.map((m: { user_id: string }) => m.user_id);
    }
    if (!userIds.length) throw BadRequest('Provide user_ids or cohort_id with members');

    const created: unknown[] = [];
    for (const userId of userIds) {
      const { rows: uRow } = await pool.query(
        `SELECT display_name FROM users WHERE user_id = $1`, [userId]
      );
      const displayName = uRow[0]?.display_name ?? userId;
      const boardTitle = body.title_pattern
        .replace('{display_name}', displayName)
        .replace('{template_name}', template.name);

      const { rows: newBoard } = await pool.query(
        `INSERT INTO kanban_boards (tenant_id, course_id, cohort_id, owner_user_id, title, template_id, settings, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'{}', $7) RETURNING *`,
        [request.tenantId, body.course_id, body.cohort_id ?? null, userId, boardTitle, id, request.user.sub]
      );
      const lanes: Array<{ title: string; color?: string; wip_limit?: number; is_done_lane?: boolean }> =
        Array.isArray(template.lane_definitions) ? template.lane_definitions : [];
      for (let pos = 0; pos < lanes.length; pos++) {
        const d = lanes[pos];
        await pool.query(
          `INSERT INTO kanban_lanes (board_id, tenant_id, title, position, color, wip_limit, is_done_lane)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [newBoard[0].board_id, request.tenantId, d.title, pos, d.color ?? '#6366f1', d.wip_limit ?? 0, d.is_done_lane ?? false]
        );
      }
      await pool.query(
        `INSERT INTO kanban_board_members (board_id, tenant_id, user_id, board_role, added_by)
         VALUES ($1,$2,$3,'member',$4) ON CONFLICT DO NOTHING`,
        [newBoard[0].board_id, request.tenantId, userId, request.user.sub]
      );
      created.push(newBoard[0]);
    }

    return reply.status(201).send({ created: created.length, boards: created });
  });
}
