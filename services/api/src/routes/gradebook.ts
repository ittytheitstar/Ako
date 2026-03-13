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
});

const gradeSchema = z.object({
  item_id: z.string().uuid(),
  user_id: z.string().uuid(),
  grade: z.number().optional(),
  feedback: z.string().optional(),
});

export async function gradebookRoutes(fastify: FastifyInstance) {
  fastify.get('/items', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id } = request.query as { course_id?: string };
    const params: unknown[] = [request.tenantId];
    let query = `SELECT * FROM grade_items WHERE tenant_id = $1`;
    if (course_id) { query += ` AND course_id = $2`; params.push(course_id); }
    query += ` ORDER BY item_id`;
    const { rows } = await pool.query(query, params);
    return reply.send({ data: rows });
  });

  fastify.post('/items', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = gradeItemSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO grade_items (tenant_id, course_id, source_type, source_id, name, max_grade, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [request.tenantId, body.data.course_id, body.data.source_type, body.data.source_id, body.data.name, body.data.max_grade, JSON.stringify(body.data.settings)]
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
}
