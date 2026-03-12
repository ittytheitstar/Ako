import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const submissionSchema = z.object({
  body: z.record(z.unknown()).default({}),
  file_ids: z.array(z.string().uuid()).default([]),
  status: z.enum(['draft', 'submitted', 'late']).default('submitted'),
});

const feedbackSchema = z.object({
  grade: z.number().optional(),
  comments: z.string().optional(),
});

export async function assignmentRoutes(fastify: FastifyInstance) {
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM assignments WHERE assignment_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Assignment not found');
    return reply.send(rows[0]);
  });

  fastify.get('/:id/submissions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM assignment_submissions WHERE assignment_id = $1 AND tenant_id = $2 ORDER BY submitted_at DESC`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/submissions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = submissionSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    // UNIQUE constraint on (assignment_id, user_id)
    const { rows } = await pool.query(
      `INSERT INTO assignment_submissions (tenant_id, assignment_id, user_id, body, file_ids, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (assignment_id, user_id) DO UPDATE
         SET body = EXCLUDED.body,
             file_ids = EXCLUDED.file_ids,
             status = EXCLUDED.status,
             submitted_at = EXCLUDED.submitted_at
       RETURNING *`,
      [request.tenantId, id, request.user.sub, JSON.stringify(body.data.body), JSON.stringify(body.data.file_ids), body.data.status, new Date().toISOString()]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.get('/:id/submissions/:submissionId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, submissionId } = request.params as { id: string; submissionId: string };
    const { rows } = await pool.query(
      `SELECT * FROM assignment_submissions WHERE submission_id = $1 AND assignment_id = $2 AND tenant_id = $3`,
      [submissionId, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Submission not found');
    return reply.send(rows[0]);
  });

  // assignment_feedback columns: feedback_id, tenant_id, submission_id, teacher_id, grade, comments, inline_comments, created_at
  fastify.post('/:id/submissions/:submissionId/feedback', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { submissionId } = request.params as { id: string; submissionId: string };
    const body = feedbackSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO assignment_feedback (tenant_id, submission_id, teacher_id, grade, comments)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request.tenantId, submissionId, request.user.sub, body.data.grade, body.data.comments]
    );
    return reply.status(201).send(rows[0]);
  });
}
