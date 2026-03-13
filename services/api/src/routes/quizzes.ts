import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const poolSchema = z.object({
  source_category_id: z.string().uuid().optional(),
  pick_count: z.number().int().positive().default(1),
  pool_order: z.enum(['random', 'fixed']).default('random'),
  position: z.number().int().min(0).default(0),
});

const quizSettingsSchema = z.object({
  time_limit_minutes: z.number().int().positive().optional(),
  open_at: z.string().datetime().optional(),
  close_at: z.string().datetime().optional(),
  max_attempts: z.number().int().min(1).optional(),
  attempt_spacing_minutes: z.number().int().positive().optional(),
  password: z.string().optional(),
  grading_strategy: z.enum(['highest', 'average', 'latest', 'first']).optional(),
  behaviour_mode: z.enum(['deferred_feedback', 'interactive', 'immediate_feedback']).optional(),
});

export async function quizRoutes(fastify: FastifyInstance) {
  // ── Quiz Settings ────────────────────────────────────────────────────────────

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM quizzes WHERE quiz_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Quiz not found');
    return reply.send(rows[0]);
  });

  fastify.patch('/:id/settings', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = quizSettingsSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (body.data.time_limit_minutes !== undefined) { setClauses.push(`time_limit_minutes = $${params.length + 1}`); params.push(body.data.time_limit_minutes); }
    if (body.data.open_at !== undefined) { setClauses.push(`open_at = $${params.length + 1}`); params.push(body.data.open_at); }
    if (body.data.close_at !== undefined) { setClauses.push(`close_at = $${params.length + 1}`); params.push(body.data.close_at); }
    if (body.data.max_attempts !== undefined) { setClauses.push(`max_attempts = $${params.length + 1}`); params.push(body.data.max_attempts); }
    if (body.data.attempt_spacing_minutes !== undefined) { setClauses.push(`attempt_spacing_minutes = $${params.length + 1}`); params.push(body.data.attempt_spacing_minutes); }
    if (body.data.password !== undefined) { setClauses.push(`password = $${params.length + 1}`); params.push(body.data.password); }
    if (body.data.grading_strategy !== undefined) { setClauses.push(`grading_strategy = $${params.length + 1}`); params.push(body.data.grading_strategy); }
    if (body.data.behaviour_mode !== undefined) { setClauses.push(`behaviour_mode = $${params.length + 1}`); params.push(body.data.behaviour_mode); }

    if (setClauses.length === 0) throw BadRequest('No fields to update');
    params.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE quizzes SET ${setClauses.join(', ')} WHERE quiz_id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) throw NotFound('Quiz not found');
    return reply.send(rows[0]);
  });

  // ── Question Pools ───────────────────────────────────────────────────────────

  fastify.get('/:id/pools', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM quiz_question_pools p
       LEFT JOIN question_categories c ON c.category_id = p.source_category_id
       WHERE p.quiz_id = $1 AND p.tenant_id = $2
       ORDER BY p.position`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.put('/:id/pools', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ pools: z.array(poolSchema) }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM quiz_question_pools WHERE quiz_id = $1 AND tenant_id = $2`, [id, request.tenantId]);
      const inserted: unknown[] = [];
      for (const p of body.data.pools) {
        const { rows } = await client.query(
          `INSERT INTO quiz_question_pools (quiz_id, tenant_id, source_category_id, pick_count, pool_order, position)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [id, request.tenantId, p.source_category_id ?? null, p.pick_count, p.pool_order, p.position]
        );
        inserted.push(rows[0]);
      }
      await client.query('COMMIT');
      return reply.send({ data: inserted });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── Attempts ─────────────────────────────────────────────────────────────────

  fastify.get('/:id/attempts', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT a.*, u.display_name, u.email
       FROM quiz_attempts a
       JOIN users u ON u.user_id = a.user_id
       WHERE a.quiz_id = $1 AND a.tenant_id = $2
       ORDER BY a.started_at DESC`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.get('/:id/attempts/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM quiz_attempts
       WHERE quiz_id = $1 AND user_id = $2 AND tenant_id = $3
       ORDER BY started_at DESC`,
      [id, request.user.sub, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/attempts', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Validate quiz window and attempt limits
    const { rows: quiz } = await pool.query(
      `SELECT * FROM quizzes WHERE quiz_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (quiz.length === 0) throw NotFound('Quiz not found');

    const q = quiz[0];
    const now = new Date();
    if (q.open_at && now < new Date(q.open_at)) {
      throw BadRequest('Quiz has not opened yet');
    }
    if (q.close_at && now > new Date(q.close_at)) {
      throw BadRequest('Quiz window has closed');
    }

    // Check password if set
    const bodyRaw = request.body as { password?: string } | null;
    if (q.password && bodyRaw?.password !== q.password) {
      throw BadRequest('Invalid quiz password');
    }

    // Check max attempts
    const { rows: existingAttempts } = await pool.query(
      `SELECT count(*)::int AS cnt FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [id, request.user.sub, request.tenantId]
    );
    if (existingAttempts[0].cnt >= q.max_attempts) {
      throw BadRequest('Maximum number of attempts reached');
    }

    // Check attempt spacing
    if (q.attempt_spacing_minutes) {
      const { rows: lastAttempt } = await pool.query(
        `SELECT started_at FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND tenant_id = $3
         ORDER BY started_at DESC LIMIT 1`,
        [id, request.user.sub, request.tenantId]
      );
      if (lastAttempt.length > 0) {
        const lastStart = new Date(lastAttempt[0].started_at);
        const minGapMs = q.attempt_spacing_minutes * 60 * 1000;
        if (now.getTime() - lastStart.getTime() < minGapMs) {
          throw BadRequest('Minimum spacing between attempts not reached');
        }
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO quiz_attempts (tenant_id, quiz_id, user_id, status) VALUES ($1, $2, $3, 'in_progress') RETURNING *`,
      [request.tenantId, id, request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id/attempts/:attemptId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, attemptId } = request.params as { id: string; attemptId: string };
    const body = z.object({
      status: z.enum(['submitted', 'graded']).optional(),
      score: z.number().optional(),
      finished_at: z.string().datetime().optional(),
    }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const setClauses: string[] = [];
    const params: unknown[] = [];
    if (body.data.status !== undefined) { setClauses.push(`status = $${params.length + 1}`); params.push(body.data.status); }
    if (body.data.score !== undefined) { setClauses.push(`score = $${params.length + 1}`); params.push(body.data.score); }
    if (body.data.finished_at !== undefined) { setClauses.push(`finished_at = $${params.length + 1}`); params.push(body.data.finished_at); }
    if (body.data.status === 'submitted' && !body.data.finished_at) { setClauses.push(`finished_at = now()`); }

    if (setClauses.length === 0) throw BadRequest('No fields to update');
    params.push(attemptId, id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE quiz_attempts SET ${setClauses.join(', ')}
       WHERE attempt_id = $${params.length - 2} AND quiz_id = $${params.length - 1} AND tenant_id = $${params.length}
       RETURNING *`,
      params
    );
    if (rows.length === 0) throw NotFound('Attempt not found');
    return reply.send(rows[0]);
  });
}
