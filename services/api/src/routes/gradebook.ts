import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const gradeItemSchema = z.object({
  course_id: z.string().uuid(),
  source_type: z.enum(['assignment', 'quiz', 'manual', 'lti']),
  source_id: z.string().uuid().optional(),
  name: z.string().min(1),
  max_grade: z.number().positive(),
  settings: z.record(z.unknown()).default({}),
  category_id: z.string().uuid().optional(),
  weight: z.number().positive().default(1),
  extra_credit: z.boolean().default(false),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
  release_at: z.string().datetime().optional(),
  grade_type: z.enum(['numerical', 'scale', 'letter', 'pass_fail']).default('numerical'),
});

const gradeItemUpdateSchema = z.object({
  category_id: z.string().uuid().optional(),
  weight: z.number().positive().optional(),
  extra_credit: z.boolean().optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  release_at: z.string().datetime().optional().nullable(),
  grade_type: z.enum(['numerical', 'scale', 'letter', 'pass_fail']).optional(),
  name: z.string().min(1).optional(),
  max_grade: z.number().positive().optional(),
});

const gradeSchema = z.object({
  item_id: z.string().uuid(),
  user_id: z.string().uuid(),
  grade: z.number().optional(),
  feedback: z.string().optional(),
});

const gradeCategorySchema = z.object({
  course_id: z.string().uuid(),
  parent_id: z.string().uuid().optional(),
  name: z.string().min(1),
  aggregation_strategy: z.enum(['weighted_mean', 'simple_mean', 'sum', 'highest', 'lowest', 'mode']).default('weighted_mean'),
  drop_lowest: z.number().int().min(0).default(0),
  weight: z.number().min(0).max(100).default(100),
});

const gradeCategoryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  aggregation_strategy: z.enum(['weighted_mean', 'simple_mean', 'sum', 'highest', 'lowest', 'mode']).optional(),
  drop_lowest: z.number().int().min(0).optional(),
  weight: z.number().min(0).max(100).optional(),
  parent_id: z.string().uuid().optional().nullable(),
});

const gradeScaleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  levels: z.array(z.object({
    name: z.string().min(1),
    value: z.number().int(),
  })).min(1),
});

const markingWorkflowUpdateSchema = z.object({
  state: z.enum(['unmarked', 'in_progress', 'ready_for_release', 'released']),
  notes: z.string().optional(),
  moderator_id: z.string().uuid().optional(),
});

export async function gradebookRoutes(fastify: FastifyInstance) {
  // ── Grade Items ──────────────────────────────────────────────────────────────

  fastify.get('/items', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id } = request.query as { course_id?: string };
    const params: unknown[] = [request.tenantId];
    let query = `SELECT * FROM grade_items WHERE tenant_id = $1`;
    if (course_id) { query += ` AND course_id = $${params.length + 1}`; params.push(course_id); }
    query += ` ORDER BY item_id`;
    const { rows } = await pool.query(query, params);
    return reply.send({ data: rows });
  });

  fastify.post('/items', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = gradeItemSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO grade_items (tenant_id, course_id, source_type, source_id, name, max_grade, settings,
         category_id, weight, extra_credit, hidden, locked, release_at, grade_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [request.tenantId, body.data.course_id, body.data.source_type, body.data.source_id ?? null,
       body.data.name, body.data.max_grade, JSON.stringify(body.data.settings),
       body.data.category_id ?? null, body.data.weight, body.data.extra_credit,
       body.data.hidden, body.data.locked, body.data.release_at ?? null, body.data.grade_type]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.get('/items/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM grade_items WHERE item_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Grade item not found');
    return reply.send(rows[0]);
  });

  fastify.patch('/items/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = gradeItemUpdateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const setClauses: string[] = [];
    const params: unknown[] = [];
    if (body.data.category_id !== undefined) { setClauses.push(`category_id = $${params.length + 1}`); params.push(body.data.category_id); }
    if (body.data.weight !== undefined) { setClauses.push(`weight = $${params.length + 1}`); params.push(body.data.weight); }
    if (body.data.extra_credit !== undefined) { setClauses.push(`extra_credit = $${params.length + 1}`); params.push(body.data.extra_credit); }
    if (body.data.hidden !== undefined) { setClauses.push(`hidden = $${params.length + 1}`); params.push(body.data.hidden); }
    if (body.data.locked !== undefined) { setClauses.push(`locked = $${params.length + 1}`); params.push(body.data.locked); }
    if (body.data.release_at !== undefined) { setClauses.push(`release_at = $${params.length + 1}`); params.push(body.data.release_at); }
    if (body.data.grade_type !== undefined) { setClauses.push(`grade_type = $${params.length + 1}`); params.push(body.data.grade_type); }
    if (body.data.name !== undefined) { setClauses.push(`name = $${params.length + 1}`); params.push(body.data.name); }
    if (body.data.max_grade !== undefined) { setClauses.push(`max_grade = $${params.length + 1}`); params.push(body.data.max_grade); }

    if (setClauses.length === 0) throw BadRequest('No fields to update');
    params.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE grade_items SET ${setClauses.join(', ')} WHERE item_id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) throw NotFound('Grade item not found');
    return reply.send(rows[0]);
  });

  // ── Grade Release (bulk flip hidden=false) ──────────────────────────────────

  fastify.post('/items/release', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = z.object({
      category_id: z.string().uuid().optional(),
      course_id: z.string().uuid().optional(),
      item_ids: z.array(z.string().uuid()).optional(),
    }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const params: unknown[] = [request.tenantId];
    let query = `UPDATE grade_items SET hidden = false WHERE tenant_id = $1`;
    if (body.data.item_ids && body.data.item_ids.length > 0) {
      query += ` AND item_id = ANY($${params.length + 1}::uuid[])`;
      params.push(body.data.item_ids);
    } else if (body.data.category_id) {
      query += ` AND category_id = $${params.length + 1}`;
      params.push(body.data.category_id);
    } else if (body.data.course_id) {
      query += ` AND course_id = $${params.length + 1}`;
      params.push(body.data.course_id);
    }
    query += ` RETURNING item_id`;
    const { rows } = await pool.query(query, params);
    return reply.send({ released: rows.length, item_ids: rows.map((r: { item_id: string }) => r.item_id) });
  });

  // ── Grades ───────────────────────────────────────────────────────────────────

  fastify.get('/grades', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { item_id, user_id } = request.query as { item_id?: string; user_id?: string };
    const params: unknown[] = [request.tenantId];
    let query = `SELECT g.* FROM grades g WHERE g.tenant_id = $1`;
    if (item_id) { query += ` AND g.item_id = $${params.length + 1}`; params.push(item_id); }
    if (user_id) { query += ` AND g.user_id = $${params.length + 1}`; params.push(user_id); }
    const { rows } = await pool.query(query, params);
    return reply.send({ data: rows });
  });

  fastify.post('/grades', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = gradeSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    // grades UNIQUE constraint on (item_id, user_id)
    const { rows } = await pool.query(
      `INSERT INTO grades (tenant_id, item_id, user_id, grade, feedback, graded_by, graded_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (item_id, user_id) DO UPDATE
         SET grade = EXCLUDED.grade,
             feedback = EXCLUDED.feedback,
             graded_by = EXCLUDED.graded_by,
             graded_at = now()
       RETURNING *`,
      [request.tenantId, body.data.item_id, body.data.user_id, body.data.grade, body.data.feedback, request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  // ── Bulk Import (CSV-like JSON rows) ─────────────────────────────────────────

  fastify.post('/import', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = z.object({
      rows: z.array(z.object({
        item_name: z.string(),
        username: z.string(),
        grade: z.number(),
        feedback: z.string().optional(),
      })),
    }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    let imported = 0;
    const errors: string[] = [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of body.data.rows) {
        const { rows: items } = await client.query(
          `SELECT item_id FROM grade_items WHERE name = $1 AND tenant_id = $2 LIMIT 1`,
          [row.item_name, request.tenantId]
        );
        const { rows: users } = await client.query(
          `SELECT user_id FROM users WHERE username = $1 AND tenant_id = $2 LIMIT 1`,
          [row.username, request.tenantId]
        );
        if (items.length === 0) { errors.push(`Grade item '${row.item_name}' not found`); continue; }
        if (users.length === 0) { errors.push(`User '${row.username}' not found`); continue; }
        await client.query(
          `INSERT INTO grades (tenant_id, item_id, user_id, grade, feedback, graded_by, graded_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (item_id, user_id) DO UPDATE
             SET grade = EXCLUDED.grade, feedback = EXCLUDED.feedback,
                 graded_by = EXCLUDED.graded_by, graded_at = now()`,
          [request.tenantId, items[0].item_id, users[0].user_id, row.grade, row.feedback ?? null, request.user.sub]
        );
        imported++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return reply.send({ imported, errors });
  });

  // ── Bulk Export ───────────────────────────────────────────────────────────────

  fastify.get('/export', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id } = request.query as { course_id?: string };
    const params: unknown[] = [request.tenantId];
    let query = `
      SELECT gi.name AS item_name, u.username, u.display_name, u.email,
             g.grade, g.feedback, g.graded_at
      FROM grades g
      JOIN grade_items gi ON gi.item_id = g.item_id
      JOIN users u ON u.user_id = g.user_id
      WHERE g.tenant_id = $1`;
    if (course_id) { query += ` AND gi.course_id = $${params.length + 1}`; params.push(course_id); }
    query += ` ORDER BY gi.name, u.username`;
    const { rows } = await pool.query(query, params);
    return reply.send({ count: rows.length, data: rows });
  });

  // ── Grade Categories ──────────────────────────────────────────────────────────

  fastify.get('/categories', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id } = request.query as { course_id?: string };
    const params: unknown[] = [request.tenantId];
    let query = `SELECT * FROM grade_categories WHERE tenant_id = $1`;
    if (course_id) { query += ` AND course_id = $${params.length + 1}`; params.push(course_id); }
    query += ` ORDER BY name`;
    const { rows } = await pool.query(query, params);
    return reply.send({ data: rows });
  });

  fastify.post('/categories', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = gradeCategorySchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO grade_categories (tenant_id, course_id, parent_id, name, aggregation_strategy, drop_lowest, weight)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [request.tenantId, body.data.course_id, body.data.parent_id ?? null, body.data.name,
       body.data.aggregation_strategy, body.data.drop_lowest, body.data.weight]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/categories/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = gradeCategoryUpdateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const setClauses: string[] = ['updated_at = now()'];
    const params: unknown[] = [];
    if (body.data.name !== undefined) { setClauses.push(`name = $${params.length + 1}`); params.push(body.data.name); }
    if (body.data.aggregation_strategy !== undefined) { setClauses.push(`aggregation_strategy = $${params.length + 1}`); params.push(body.data.aggregation_strategy); }
    if (body.data.drop_lowest !== undefined) { setClauses.push(`drop_lowest = $${params.length + 1}`); params.push(body.data.drop_lowest); }
    if (body.data.weight !== undefined) { setClauses.push(`weight = $${params.length + 1}`); params.push(body.data.weight); }
    if (body.data.parent_id !== undefined) { setClauses.push(`parent_id = $${params.length + 1}`); params.push(body.data.parent_id); }

    params.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE grade_categories SET ${setClauses.join(', ')} WHERE category_id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) throw NotFound('Grade category not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/categories/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(
      `DELETE FROM grade_categories WHERE category_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    return reply.status(204).send();
  });

  // ── Grade Scales ──────────────────────────────────────────────────────────────

  fastify.get('/scales', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows: scales } = await pool.query(
      `SELECT s.*, json_agg(l ORDER BY l.value DESC) AS levels
       FROM grade_scales s
       LEFT JOIN grade_scale_levels l ON l.scale_id = s.scale_id
       WHERE s.tenant_id = $1
       GROUP BY s.scale_id
       ORDER BY s.name`,
      [request.tenantId]
    );
    return reply.send({ data: scales });
  });

  fastify.post('/scales', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = gradeScaleSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: sRows } = await client.query(
        `INSERT INTO grade_scales (tenant_id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
        [request.tenantId, body.data.name, body.data.description ?? null, request.user.sub]
      );
      const levels: unknown[] = [];
      for (const level of body.data.levels) {
        const { rows: lRows } = await client.query(
          `INSERT INTO grade_scale_levels (scale_id, name, value) VALUES ($1, $2, $3) RETURNING *`,
          [sRows[0].scale_id, level.name, level.value]
        );
        levels.push(lRows[0]);
      }
      await client.query('COMMIT');
      return reply.status(201).send({ ...sRows[0], levels });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  fastify.delete('/scales/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM grade_scales WHERE scale_id = $1 AND tenant_id = $2`, [id, request.tenantId]);
    return reply.status(204).send();
  });

  // ── Marking Workflow ──────────────────────────────────────────────────────────

  fastify.get('/marking-workflow', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id, state } = request.query as { course_id?: string; state?: string };
    const params: unknown[] = [request.tenantId];
    let query = `
      SELECT mws.*, gi.name AS item_name, u.display_name, u.email,
             marker.display_name AS marker_name, mod.display_name AS moderator_name
      FROM marking_workflow_states mws
      JOIN grade_items gi ON gi.item_id = mws.item_id
      JOIN users u ON u.user_id = mws.user_id
      LEFT JOIN users marker ON marker.user_id = mws.marker_id
      LEFT JOIN users mod ON mod.user_id = mws.moderator_id
      WHERE mws.tenant_id = $1`;
    if (course_id) { query += ` AND gi.course_id = $${params.length + 1}`; params.push(course_id); }
    if (state) { query += ` AND mws.state = $${params.length + 1}`; params.push(state); }
    query += ` ORDER BY mws.updated_at DESC`;
    const { rows } = await pool.query(query, params);
    return reply.send({ data: rows });
  });

  fastify.patch('/marking-workflow/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = markingWorkflowUpdateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const setClauses: string[] = ['updated_at = now()', `state = $1`, `marker_id = $2`];
    const params: unknown[] = [body.data.state, request.user.sub];
    if (body.data.notes !== undefined) { setClauses.push(`notes = $${params.length + 1}`); params.push(body.data.notes); }
    if (body.data.moderator_id !== undefined) { setClauses.push(`moderator_id = $${params.length + 1}`); params.push(body.data.moderator_id); }

    params.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE marking_workflow_states SET ${setClauses.join(', ')}
       WHERE mws_id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) throw NotFound('Marking workflow state not found');
    return reply.send(rows[0]);
  });

  fastify.post('/marking-workflow', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = z.object({
      item_id: z.string().uuid(),
      user_id: z.string().uuid(),
      state: z.enum(['unmarked', 'in_progress', 'ready_for_release', 'released']).default('unmarked'),
      notes: z.string().optional(),
      moderator_id: z.string().uuid().optional(),
    }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO marking_workflow_states (tenant_id, item_id, user_id, state, marker_id, moderator_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (item_id, user_id) DO UPDATE SET state = EXCLUDED.state, marker_id = EXCLUDED.marker_id,
         moderator_id = EXCLUDED.moderator_id, notes = EXCLUDED.notes, updated_at = now()
       RETURNING *`,
      [request.tenantId, body.data.item_id, body.data.user_id, body.data.state,
       request.user.sub, body.data.moderator_id ?? null, body.data.notes ?? null]
    );
    return reply.status(201).send(rows[0]);
  });
}
