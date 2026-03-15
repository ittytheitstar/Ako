import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const lessonConfigSchema = z.object({
  time_limit_minutes: z.number().int().positive().optional(),
  max_attempts: z.number().int().min(0).default(0),
  passing_grade: z.number().min(0).max(100).default(0),
});

const pageCreateSchema = z.object({
  page_type: z.enum(['content', 'question', 'end_of_lesson', 'branch_table']),
  title: z.string().min(1),
  body: z.record(z.unknown()).default({}),
  question: z.record(z.unknown()).default({}),
  jump_target: z.string().default('next'),
  position: z.number().int().min(0).default(0),
});

const pageUpdateSchema = pageCreateSchema.partial();

const answerSchema = z.object({
  answer: z.record(z.unknown()),
});

export async function lessonRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Lesson config ─────────────────────────────────────────────────────────

  fastify.get('/:moduleId', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows } = await pool.query(
      `SELECT * FROM lessons WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Lesson not found');
    return reply.send(rows[0]);
  });

  fastify.put('/:moduleId', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = lessonConfigSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;
    const { rows } = await pool.query(
      `INSERT INTO lessons (module_id, tenant_id, time_limit_minutes, max_attempts, passing_grade)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (module_id) DO UPDATE SET
         time_limit_minutes = EXCLUDED.time_limit_minutes,
         max_attempts       = EXCLUDED.max_attempts,
         passing_grade      = EXCLUDED.passing_grade,
         updated_at         = now()
       RETURNING *`,
      [moduleId, request.tenantId, d.time_limit_minutes ?? null, d.max_attempts, d.passing_grade]
    );
    return reply.status(200).send(rows[0]);
  });

  // ── Pages ─────────────────────────────────────────────────────────────────

  fastify.get('/:moduleId/pages', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows: lessons } = await pool.query(
      `SELECT lesson_id FROM lessons WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (lessons.length === 0) throw NotFound('Lesson not found');
    const { rows } = await pool.query(
      `SELECT * FROM lesson_pages WHERE lesson_id = $1 AND tenant_id = $2 ORDER BY position`,
      [lessons[0].lesson_id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:moduleId/pages', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = pageCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows: lessons } = await pool.query(
      `SELECT lesson_id FROM lessons WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (lessons.length === 0) throw NotFound('Lesson not found');
    const d = body.data;
    const { rows } = await pool.query(
      `INSERT INTO lesson_pages (lesson_id, tenant_id, page_type, title, body, question, jump_target, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        lessons[0].lesson_id, request.tenantId,
        d.page_type, d.title, JSON.stringify(d.body), JSON.stringify(d.question),
        d.jump_target, d.position,
      ]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.put('/:moduleId/pages/:pageId', async (request, reply) => {
    const { moduleId, pageId } = request.params as { moduleId: string; pageId: string };
    const body = pageUpdateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows: lessons } = await pool.query(
      `SELECT lesson_id FROM lessons WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (lessons.length === 0) throw NotFound('Lesson not found');
    const d = body.data;
    const sets: string[] = [];
    const params: unknown[] = [pageId, lessons[0].lesson_id, request.tenantId];
    if (d.page_type !== undefined) { params.push(d.page_type); sets.push(`page_type = $${params.length}`); }
    if (d.title !== undefined) { params.push(d.title); sets.push(`title = $${params.length}`); }
    if (d.body !== undefined) { params.push(JSON.stringify(d.body)); sets.push(`body = $${params.length}`); }
    if (d.question !== undefined) { params.push(JSON.stringify(d.question)); sets.push(`question = $${params.length}`); }
    if (d.jump_target !== undefined) { params.push(d.jump_target); sets.push(`jump_target = $${params.length}`); }
    if (d.position !== undefined) { params.push(d.position); sets.push(`position = $${params.length}`); }
    if (sets.length === 0) throw BadRequest('No fields to update');
    sets.push('updated_at = now()');
    const { rows } = await pool.query(
      `UPDATE lesson_pages SET ${sets.join(', ')}
       WHERE page_id = $1 AND lesson_id = $2 AND tenant_id = $3
       RETURNING *`,
      params
    );
    if (rows.length === 0) throw NotFound('Page not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:moduleId/pages/:pageId', async (request, reply) => {
    const { moduleId, pageId } = request.params as { moduleId: string; pageId: string };
    const { rows: lessons } = await pool.query(
      `SELECT lesson_id FROM lessons WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (lessons.length === 0) throw NotFound('Lesson not found');
    const { rowCount } = await pool.query(
      `DELETE FROM lesson_pages WHERE page_id = $1 AND lesson_id = $2 AND tenant_id = $3`,
      [pageId, lessons[0].lesson_id, request.tenantId]
    );
    if (!rowCount) throw NotFound('Page not found');
    return reply.status(204).send();
  });

  // ── Attempts ─────────────────────────────────────────────────────────────

  fastify.post('/:moduleId/attempts', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows: lessons } = await pool.query(
      `SELECT * FROM lessons WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (lessons.length === 0) throw NotFound('Lesson not found');
    const lesson = lessons[0];

    if (lesson.max_attempts > 0) {
      const { rows: attempts } = await pool.query(
        `SELECT COUNT(*) AS cnt FROM lesson_attempts
         WHERE lesson_id = $1 AND user_id = $2 AND completed_at IS NOT NULL`,
        [lesson.lesson_id, request.user.sub]
      );
      if (parseInt(attempts[0].cnt, 10) >= lesson.max_attempts) {
        throw BadRequest('Maximum attempts reached');
      }
    }

    const { rows: pages } = await pool.query(
      `SELECT page_id FROM lesson_pages WHERE lesson_id = $1 AND tenant_id = $2 ORDER BY position LIMIT 1`,
      [lesson.lesson_id, request.tenantId]
    );
    const firstPageId = pages.length > 0 ? pages[0].page_id : null;

    const { rows } = await pool.query(
      `INSERT INTO lesson_attempts (lesson_id, tenant_id, user_id, current_page_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [lesson.lesson_id, request.tenantId, request.user.sub, firstPageId]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.post('/:moduleId/attempts/:attemptId/answer', async (request, reply) => {
    const { moduleId, attemptId } = request.params as { moduleId: string; attemptId: string };
    const body = answerSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: attempts } = await pool.query(
      `SELECT a.*, l.lesson_id FROM lesson_attempts a
       JOIN lessons l ON l.lesson_id = a.lesson_id
       WHERE a.attempt_id = $1 AND a.user_id = $2 AND a.tenant_id = $3 AND l.module_id = $4`,
      [attemptId, request.user.sub, request.tenantId, moduleId]
    );
    if (attempts.length === 0) throw NotFound('Attempt not found');
    const attempt = attempts[0];
    if (attempt.completed_at) throw BadRequest('Attempt already completed');
    if (!attempt.current_page_id) throw BadRequest('No current page');

    const { rows: pages } = await pool.query(
      `SELECT * FROM lesson_pages WHERE page_id = $1`,
      [attempt.current_page_id]
    );
    if (pages.length === 0) throw NotFound('Page not found');
    const currentPage = pages[0];

    // Evaluate correctness for question pages using stable JSON comparison
    let correct: boolean | null = null;
    if (currentPage.page_type === 'question' && currentPage.question?.correct_answer !== undefined) {
      const normalize = (v: unknown) => JSON.stringify(v, Object.keys(v as object).sort());
      try {
        correct = normalize(body.data.answer) === normalize(currentPage.question.correct_answer);
      } catch {
        correct = JSON.stringify(body.data.answer) === JSON.stringify(currentPage.question.correct_answer);
      }
    }

    await pool.query(
      `INSERT INTO lesson_attempt_answers (attempt_id, page_id, answer, correct)
       VALUES ($1, $2, $3, $4)`,
      [attemptId, attempt.current_page_id, JSON.stringify(body.data.answer), correct]
    );

    // Resolve next page
    let nextPage: Record<string, unknown> | null = null;
    const jumpTarget = currentPage.jump_target ?? 'next';

    if (jumpTarget === 'next') {
      const { rows: nextPages } = await pool.query(
        `SELECT * FROM lesson_pages
         WHERE lesson_id = $1 AND position > $2 AND tenant_id = $3
         ORDER BY position LIMIT 1`,
        [currentPage.lesson_id, currentPage.position, request.tenantId]
      );
      nextPage = nextPages.length > 0 ? nextPages[0] : null;
    } else if (jumpTarget === 'end') {
      nextPage = null;
    } else {
      // jump_target is a page_id
      const { rows: targetPages } = await pool.query(
        `SELECT * FROM lesson_pages WHERE page_id = $1 AND lesson_id = $2`,
        [jumpTarget, currentPage.lesson_id]
      );
      nextPage = targetPages.length > 0 ? targetPages[0] : null;
    }

    await pool.query(
      `UPDATE lesson_attempts SET current_page_id = $1 WHERE attempt_id = $2`,
      [nextPage ? nextPage.page_id : null, attemptId]
    );

    return reply.send({ correct, next_page: nextPage });
  });

  fastify.post('/:moduleId/attempts/:attemptId/finish', async (request, reply) => {
    const { moduleId, attemptId } = request.params as { moduleId: string; attemptId: string };

    const { rows: attempts } = await pool.query(
      `SELECT a.*, l.passing_grade FROM lesson_attempts a
       JOIN lessons l ON l.lesson_id = a.lesson_id
       WHERE a.attempt_id = $1 AND a.user_id = $2 AND a.tenant_id = $3 AND l.module_id = $4`,
      [attemptId, request.user.sub, request.tenantId, moduleId]
    );
    if (attempts.length === 0) throw NotFound('Attempt not found');
    const attempt = attempts[0];
    if (attempt.completed_at) throw BadRequest('Attempt already completed');

    // Calculate score from answered questions
    const { rows: answers } = await pool.query(
      `SELECT correct FROM lesson_attempt_answers WHERE attempt_id = $1`,
      [attemptId]
    );
    const questions = answers.filter((a) => a.correct !== null);
    const score =
      questions.length > 0
        ? (questions.filter((a) => a.correct).length / questions.length) * 100
        : null;

    const { rows } = await pool.query(
      `UPDATE lesson_attempts SET score = $1, completed_at = now(), current_page_id = NULL
       WHERE attempt_id = $2
       RETURNING *`,
      [score, attemptId]
    );

    await pool.query(
      `INSERT INTO event_outbox (tenant_id, topic, payload)
       VALUES ($1, $2, $3)`,
      [
        request.tenantId,
        'lesson.attempt.completed',
        JSON.stringify({ attempt_id: attemptId, user_id: request.user.sub, score }),
      ]
    );

    return reply.send(rows[0]);
  });
}
