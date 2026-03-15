import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const choiceConfigSchema = z.object({
  question: z.string().min(1),
  close_at: z.string().datetime().optional(),
  allow_update: z.boolean().default(true),
  show_results: z.enum(['after_answer', 'after_close', 'never']).default('after_answer'),
  multiple_select: z.boolean().default(false),
  anonymous: z.boolean().default(false),
  options: z.array(
    z.object({
      text: z.string().min(1),
      max_answers: z.number().int().positive().optional(),
    })
  ).min(1),
});

const answerSchema = z.object({
  option_ids: z.array(z.string().uuid()).min(1),
});

export async function choiceRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Choice config ─────────────────────────────────────────────────────────

  fastify.get('/:moduleId', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows } = await pool.query(
      `SELECT * FROM choices WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Choice activity not found');
    const choice = rows[0];
    const { rows: options } = await pool.query(
      `SELECT * FROM choice_options WHERE choice_id = $1 ORDER BY position`,
      [choice.choice_id]
    );
    return reply.send({ ...choice, options });
  });

  fastify.put('/:moduleId', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = choiceConfigSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO choices (module_id, tenant_id, question, close_at, allow_update, show_results, multiple_select, anonymous)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (module_id) DO UPDATE SET
           question        = EXCLUDED.question,
           close_at        = EXCLUDED.close_at,
           allow_update    = EXCLUDED.allow_update,
           show_results    = EXCLUDED.show_results,
           multiple_select = EXCLUDED.multiple_select,
           anonymous       = EXCLUDED.anonymous,
           updated_at      = now()
         RETURNING *`,
        [moduleId, request.tenantId, d.question, d.close_at ?? null, d.allow_update, d.show_results, d.multiple_select, d.anonymous]
      );
      const choice = rows[0];

      await client.query(`DELETE FROM choice_options WHERE choice_id = $1`, [choice.choice_id]);
      const options = [];
      for (let i = 0; i < d.options.length; i++) {
        const opt = d.options[i];
        const { rows: optRows } = await client.query(
          `INSERT INTO choice_options (choice_id, tenant_id, text, max_answers, position)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [choice.choice_id, request.tenantId, opt.text, opt.max_answers ?? null, i]
        );
        options.push(optRows[0]);
      }

      await client.query('COMMIT');
      return reply.status(200).send({ ...choice, options });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── Submit answer ─────────────────────────────────────────────────────────

  fastify.post('/:moduleId/answers', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = answerSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: choices } = await pool.query(
      `SELECT * FROM choices WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (choices.length === 0) throw NotFound('Choice activity not found');
    const choice = choices[0];

    if (choice.close_at && new Date(choice.close_at) < new Date()) {
      throw BadRequest('Choice is closed');
    }

    if (!choice.multiple_select && body.data.option_ids.length > 1) {
      throw BadRequest('Multiple selections not allowed');
    }

    // Validate option_ids belong to this choice
    const { rows: validOpts } = await pool.query(
      `SELECT option_id FROM choice_options WHERE choice_id = $1 AND option_id = ANY($2::uuid[])`,
      [choice.choice_id, body.data.option_ids]
    );
    if (validOpts.length !== body.data.option_ids.length) {
      throw BadRequest('One or more option IDs are invalid');
    }

    const { rows: existing } = await pool.query(
      `SELECT answer_id FROM choice_answers WHERE choice_id = $1 AND user_id = $2`,
      [choice.choice_id, request.user.sub]
    );

    if (existing.length > 0 && !choice.allow_update) {
      throw BadRequest('Answer already submitted and updates are not allowed');
    }

    const { rows } = await pool.query(
      `INSERT INTO choice_answers (choice_id, tenant_id, user_id, option_ids)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (choice_id, user_id) DO UPDATE SET
         option_ids = EXCLUDED.option_ids,
         updated_at = now()
       RETURNING *`,
      [choice.choice_id, request.tenantId, request.user.sub, body.data.option_ids]
    );

    await pool.query(
      `INSERT INTO event_outbox (tenant_id, topic, payload) VALUES ($1, $2, $3)`,
      [
        request.tenantId,
        'choice.answer.submitted',
        JSON.stringify({ choice_id: choice.choice_id, user_id: request.user.sub }),
      ]
    );

    return reply.status(200).send(rows[0]);
  });

  // ── Results ───────────────────────────────────────────────────────────────

  fastify.get('/:moduleId/results', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows: choices } = await pool.query(
      `SELECT * FROM choices WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (choices.length === 0) throw NotFound('Choice activity not found');
    const choice = choices[0];

    if (choice.show_results === 'never') {
      return reply.status(403).send({ error: 'Results are not available for this choice' });
    }

    const isClosed = choice.close_at && new Date(choice.close_at) < new Date();
    if (choice.show_results === 'after_close' && !isClosed) {
      // Check if requester has a teacher role
      const { rows: roles } = await pool.query(
        `SELECT r.name FROM user_roles ur
         JOIN roles r ON r.role_id = ur.role_id
         WHERE ur.user_id = $1 AND ur.tenant_id = $2`,
        [request.user.sub, request.tenantId]
      );
      const isTeacher = roles.some((r) => ['teacher', 'admin', 'manager'].includes(r.name));
      if (!isTeacher) {
        return reply.status(403).send({ error: 'Results are not available until the choice is closed' });
      }
    }

    const { rows: options } = await pool.query(
      `SELECT o.option_id, o.text, o.position,
              COUNT(a.answer_id) FILTER (WHERE o.option_id = ANY(a.option_ids)) AS answer_count
       FROM choice_options o
       LEFT JOIN choice_answers a ON a.choice_id = o.choice_id
       WHERE o.choice_id = $1
       GROUP BY o.option_id, o.text, o.position
       ORDER BY o.position`,
      [choice.choice_id]
    );

    const { rows: totals } = await pool.query(
      `SELECT COUNT(*) AS total_responses FROM choice_answers WHERE choice_id = $1`,
      [choice.choice_id]
    );

    return reply.send({
      choice_id: choice.choice_id,
      question: choice.question,
      anonymous: choice.anonymous,
      total_responses: parseInt(totals[0].total_responses, 10),
      options,
    });
  });
}
