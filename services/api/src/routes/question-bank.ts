import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parent_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
});

const questionSchema = z.object({
  category_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
  qtype: z.enum(['mcq', 'multi', 'short', 'essay', 'match', 'truefalse']),
  status: z.enum(['draft', 'published', 'deprecated']).default('draft'),
  tags: z.array(z.string()).default([]),
  prompt: z.record(z.unknown()),
  options: z.record(z.unknown()).default({}),
  answer_key: z.record(z.unknown()).default({}),
  points: z.number().positive().default(1),
});

const updateQuestionSchema = z.object({
  category_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'deprecated']).optional(),
  tags: z.array(z.string()).optional(),
  prompt: z.record(z.unknown()).optional(),
  options: z.record(z.unknown()).optional(),
  answer_key: z.record(z.unknown()).optional(),
  points: z.number().positive().optional(),
});

export async function questionBankRoutes(fastify: FastifyInstance) {
  // ── Categories ──────────────────────────────────────────────────────────────

  fastify.get('/categories', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id } = request.query as { course_id?: string };
    const params: unknown[] = [request.tenantId];
    let query = `SELECT * FROM question_categories WHERE tenant_id = $1`;
    if (course_id) {
      query += ` AND (course_id = $2 OR course_id IS NULL)`;
      params.push(course_id);
    }
    query += ` ORDER BY name`;
    const { rows } = await pool.query(query, params);
    return reply.send({ data: rows });
  });

  fastify.post('/categories', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = categorySchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO question_categories (tenant_id, course_id, parent_id, name, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [request.tenantId, body.data.course_id ?? null, body.data.parent_id ?? null, body.data.name, body.data.description ?? null, request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.delete('/categories/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(
      `DELETE FROM question_categories WHERE category_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    return reply.status(204).send();
  });

  // ── Questions ───────────────────────────────────────────────────────────────

  fastify.get('/questions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { category_id, status, tag, course_id } = request.query as {
      category_id?: string;
      status?: string;
      tag?: string;
      course_id?: string;
    };
    const params: unknown[] = [request.tenantId];
    let query = `
      SELECT q.*,
             json_build_object(
               'version_id', v.version_id, 'version_num', v.version_num,
               'prompt', v.prompt, 'options', v.options, 'answer_key', v.answer_key,
               'points', v.points, 'created_at', v.created_at
             ) AS latest_version
      FROM questions q
      LEFT JOIN LATERAL (
        SELECT * FROM question_versions
        WHERE question_id = q.question_id
        ORDER BY version_num DESC LIMIT 1
      ) v ON true
      WHERE q.tenant_id = $1`;
    if (category_id) { query += ` AND q.category_id = $${params.length + 1}`; params.push(category_id); }
    if (status) { query += ` AND q.status = $${params.length + 1}`; params.push(status); }
    if (tag) { query += ` AND $${params.length + 1} = ANY(q.tags)`; params.push(tag); }
    if (course_id) { query += ` AND (q.course_id = $${params.length + 1} OR q.course_id IS NULL)`; params.push(course_id); }
    query += ` ORDER BY q.created_at DESC`;
    const { rows } = await pool.query(query, params);
    return reply.send({ data: rows });
  });

  fastify.post('/questions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = questionSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: qRows } = await client.query(
        `INSERT INTO questions (tenant_id, course_id, category_id, qtype, status, tags, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [request.tenantId, body.data.course_id ?? null, body.data.category_id ?? null,
         body.data.qtype, body.data.status, body.data.tags, request.user.sub]
      );
      const question = qRows[0];
      const { rows: vRows } = await client.query(
        `INSERT INTO question_versions (question_id, version_num, prompt, options, answer_key, points, created_by)
         VALUES ($1, 1, $2, $3, $4, $5, $6) RETURNING *`,
        [question.question_id, JSON.stringify(body.data.prompt), JSON.stringify(body.data.options),
         JSON.stringify(body.data.answer_key), body.data.points, request.user.sub]
      );
      await client.query('COMMIT');
      return reply.status(201).send({ ...question, latest_version: vRows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  fastify.get('/questions/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM questions WHERE question_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Question not found');
    const question = rows[0];
    const { rows: versions } = await pool.query(
      `SELECT * FROM question_versions WHERE question_id = $1 ORDER BY version_num DESC`,
      [id]
    );
    return reply.send({ ...question, versions });
  });

  fastify.put('/questions/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateQuestionSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: existing } = await pool.query(
      `SELECT * FROM questions WHERE question_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (existing.length === 0) throw NotFound('Question not found');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Update question metadata
      const setClauses: string[] = ['updated_at = now()'];
      const updateParams: unknown[] = [];
      if (body.data.category_id !== undefined) { setClauses.push(`category_id = $${updateParams.length + 1}`); updateParams.push(body.data.category_id); }
      if (body.data.status !== undefined) { setClauses.push(`status = $${updateParams.length + 1}`); updateParams.push(body.data.status); }
      if (body.data.tags !== undefined) { setClauses.push(`tags = $${updateParams.length + 1}`); updateParams.push(body.data.tags); }
      updateParams.push(id, request.tenantId);
      const { rows: qRows } = await client.query(
        `UPDATE questions SET ${setClauses.join(', ')} WHERE question_id = $${updateParams.length - 1} AND tenant_id = $${updateParams.length} RETURNING *`,
        updateParams
      );

      // Create new version if content changed
      let versionRow = null;
      if (body.data.prompt !== undefined || body.data.options !== undefined || body.data.answer_key !== undefined || body.data.points !== undefined) {
        const { rows: lastVersion } = await client.query(
          `SELECT * FROM question_versions WHERE question_id = $1 ORDER BY version_num DESC LIMIT 1`,
          [id]
        );
        const lastVNum = lastVersion[0]?.version_num ?? 0;
        const newPrompt = body.data.prompt ?? lastVersion[0]?.prompt ?? {};
        const newOptions = body.data.options ?? lastVersion[0]?.options ?? {};
        const newAnswerKey = body.data.answer_key ?? lastVersion[0]?.answer_key ?? {};
        const newPoints = body.data.points ?? lastVersion[0]?.points ?? 1;
        const { rows: vRows } = await client.query(
          `INSERT INTO question_versions (question_id, version_num, prompt, options, answer_key, points, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [id, lastVNum + 1, JSON.stringify(newPrompt), JSON.stringify(newOptions),
           JSON.stringify(newAnswerKey), newPoints, request.user.sub]
        );
        versionRow = vRows[0];
      }
      await client.query('COMMIT');
      return reply.send({ ...qRows[0], new_version: versionRow });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  fastify.delete('/questions/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(
      `UPDATE questions SET status = 'deprecated', updated_at = now() WHERE question_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    return reply.status(204).send();
  });

  // ── Import / Export ─────────────────────────────────────────────────────────

  fastify.post('/import', { preHandler: fastify.authenticate }, async (request, reply) => {
    // Accept a JSON array of question objects for simplicity (QTI/Moodle XML parsing is a heavy dependency)
    const body = z.object({
      questions: z.array(z.object({
        category_id: z.string().uuid().optional(),
        course_id: z.string().uuid().optional(),
        qtype: z.enum(['mcq', 'multi', 'short', 'essay', 'match', 'truefalse']),
        status: z.enum(['draft', 'published', 'deprecated']).default('draft'),
        tags: z.array(z.string()).default([]),
        prompt: z.record(z.unknown()),
        options: z.record(z.unknown()).default({}),
        answer_key: z.record(z.unknown()).default({}),
        points: z.number().positive().default(1),
      })),
      format: z.enum(['json', 'qti', 'moodle']).default('json'),
    }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const imported: unknown[] = [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const q of body.data.questions) {
        const { rows: qRows } = await client.query(
          `INSERT INTO questions (tenant_id, course_id, category_id, qtype, status, tags, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [request.tenantId, q.course_id ?? null, q.category_id ?? null,
           q.qtype, q.status, q.tags, request.user.sub]
        );
        await client.query(
          `INSERT INTO question_versions (question_id, version_num, prompt, options, answer_key, points, created_by)
           VALUES ($1, 1, $2, $3, $4, $5, $6)`,
          [qRows[0].question_id, JSON.stringify(q.prompt), JSON.stringify(q.options),
           JSON.stringify(q.answer_key), q.points, request.user.sub]
        );
        imported.push(qRows[0]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return reply.status(201).send({ imported: imported.length, data: imported });
  });

  fastify.get('/export', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { category_id, course_id } = request.query as { category_id?: string; course_id?: string };
    const params: unknown[] = [request.tenantId];
    let query = `
      SELECT q.*, v.prompt, v.options, v.answer_key, v.points, v.version_num
      FROM questions q
      JOIN LATERAL (
        SELECT * FROM question_versions
        WHERE question_id = q.question_id
        ORDER BY version_num DESC LIMIT 1
      ) v ON true
      WHERE q.tenant_id = $1 AND q.status = 'published'`;
    if (category_id) { query += ` AND q.category_id = $${params.length + 1}`; params.push(category_id); }
    if (course_id) { query += ` AND (q.course_id = $${params.length + 1} OR q.course_id IS NULL)`; params.push(course_id); }
    const { rows } = await pool.query(query, params);
    return reply.send({ format: 'json', count: rows.length, questions: rows });
  });
}
