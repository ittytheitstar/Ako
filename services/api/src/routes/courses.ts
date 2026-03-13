import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const courseSchema = z.object({
  course_code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(['private', 'tenant', 'public']).default('private'),
});

const sectionSchema = z.object({
  title: z.string().min(1),
  position: z.number().int().min(0).default(0),
  summary: z.string().optional(),
});

const moduleSchema = z.object({
  section_id: z.string().uuid().optional(),
  module_type: z.enum(['page', 'file', 'forum', 'assignment', 'quiz', 'lti', 'scorm']),
  title: z.string().min(1),
  settings: z.record(z.unknown()).default({}),
  availability: z.record(z.unknown()).default({}),
});

const enrolmentSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['student', 'teacher', 'ta', 'observer']).default('student'),
  status: z.enum(['active', 'suspended', 'completed']).default('active'),
  cohort_id: z.string().uuid().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
});

export async function courseRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { cursor, limit = 20 } = request.query as { cursor?: string; limit?: number };
    const params: unknown[] = [request.tenantId, Math.min(Number(limit), 100)];
    let query = `SELECT * FROM courses WHERE tenant_id = $1 AND archived_at IS NULL`;
    if (cursor) { query += ` AND course_id > $3`; params.push(cursor); }
    query += ` ORDER BY course_id LIMIT $2`;
    const { rows } = await pool.query(query, params);
    return reply.send({
      data: rows,
      nextCursor: rows.length === Number(limit) ? rows[rows.length - 1].course_id : undefined,
    });
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM courses WHERE course_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Course not found');
    return reply.send(rows[0]);
  });

  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = courseSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO courses (tenant_id, course_code, title, description, visibility, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [request.tenantId, body.data.course_code, body.data.title, body.data.description, body.data.visibility, request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = courseSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const d = body.data;
    if (d.course_code !== undefined) { fields.push(`course_code = $${i++}`); values.push(d.course_code); }
    if (d.title !== undefined) { fields.push(`title = $${i++}`); values.push(d.title); }
    if (d.description !== undefined) { fields.push(`description = $${i++}`); values.push(d.description); }
    if (d.visibility !== undefined) { fields.push(`visibility = $${i++}`); values.push(d.visibility); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE courses SET ${fields.join(', ')} WHERE course_id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Course not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `UPDATE courses SET archived_at = now() WHERE course_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Course not found');
    return reply.status(204).send();
  });

  // Sections
  fastify.get('/:id/sections', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM course_sections WHERE course_id = $1 AND tenant_id = $2 ORDER BY position`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/sections', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = sectionSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO course_sections (tenant_id, course_id, title, position, summary) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request.tenantId, id, body.data.title, body.data.position, body.data.summary]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id/sections/:sectionId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, sectionId } = request.params as { id: string; sectionId: string };
    const body = sectionSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.data.title !== undefined) { fields.push(`title = $${i++}`); values.push(body.data.title); }
    if (body.data.position !== undefined) { fields.push(`position = $${i++}`); values.push(body.data.position); }
    if (body.data.summary !== undefined) { fields.push(`summary = $${i++}`); values.push(body.data.summary); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    values.push(sectionId, id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE course_sections SET ${fields.join(', ')}
       WHERE section_id = $${i} AND course_id = $${i + 1} AND tenant_id = $${i + 2} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Section not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id/sections/:sectionId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, sectionId } = request.params as { id: string; sectionId: string };
    const { rowCount } = await pool.query(
      `DELETE FROM course_sections WHERE section_id = $1 AND course_id = $2 AND tenant_id = $3`,
      [sectionId, id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Section not found');
    return reply.status(204).send();
  });

  // Modules
  fastify.get('/:id/modules', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM course_modules WHERE course_id = $1 AND tenant_id = $2 ORDER BY created_at`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/modules', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = moduleSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO course_modules (tenant_id, course_id, section_id, module_type, title, settings, availability)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [request.tenantId, id, body.data.section_id, body.data.module_type, body.data.title, JSON.stringify(body.data.settings), JSON.stringify(body.data.availability)]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id/modules/:moduleId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, moduleId } = request.params as { id: string; moduleId: string };
    const body = moduleSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const d = body.data;
    if (d.title !== undefined) { fields.push(`title = $${i++}`); values.push(d.title); }
    if (d.section_id !== undefined) { fields.push(`section_id = $${i++}`); values.push(d.section_id); }
    if (d.settings !== undefined) { fields.push(`settings = $${i++}`); values.push(JSON.stringify(d.settings)); }
    if (d.availability !== undefined) { fields.push(`availability = $${i++}`); values.push(JSON.stringify(d.availability)); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    values.push(moduleId, id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE course_modules SET ${fields.join(', ')}
       WHERE module_id = $${i} AND course_id = $${i + 1} AND tenant_id = $${i + 2} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Module not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id/modules/:moduleId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, moduleId } = request.params as { id: string; moduleId: string };
    const { rowCount } = await pool.query(
      `DELETE FROM course_modules WHERE module_id = $1 AND course_id = $2 AND tenant_id = $3`,
      [moduleId, id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Module not found');
    return reply.status(204).send();
  });

  // Enrolments
  fastify.get('/:id/enrolments', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM enrolments WHERE course_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/enrolments', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = enrolmentSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO enrolments (tenant_id, course_id, user_id, role, status, cohort_id, start_at, end_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [request.tenantId, id, body.data.user_id, body.data.role, body.data.status, body.data.cohort_id, body.data.start_at, body.data.end_at]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id/enrolments/:enrolmentId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, enrolmentId } = request.params as { id: string; enrolmentId: string };
    const body = enrolmentSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const d = body.data;
    if (d.role !== undefined) { fields.push(`role = $${i++}`); values.push(d.role); }
    if (d.status !== undefined) { fields.push(`status = $${i++}`); values.push(d.status); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    values.push(enrolmentId, id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE enrolments SET ${fields.join(', ')}
       WHERE enrolment_id = $${i} AND course_id = $${i + 1} AND tenant_id = $${i + 2} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Enrolment not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id/enrolments/:enrolmentId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, enrolmentId } = request.params as { id: string; enrolmentId: string };
    const { rowCount } = await pool.query(
      `DELETE FROM enrolments WHERE enrolment_id = $1 AND course_id = $2 AND tenant_id = $3`,
      [enrolmentId, id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Enrolment not found');
    return reply.status(204).send();
  });

  // Gradebook summary per course
  fastify.get('/:id/gradebook', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [itemsResult, gradesResult] = await Promise.all([
      pool.query(`SELECT * FROM grade_items WHERE course_id = $1 AND tenant_id = $2`, [id, request.tenantId]),
      pool.query(
        `SELECT g.* FROM grades g JOIN grade_items gi ON gi.item_id = g.item_id WHERE gi.course_id = $1 AND g.tenant_id = $2`,
        [id, request.tenantId]
      ),
    ]);
    return reply.send({ items: itemsResult.rows, grades: gradesResult.rows });
  });
}
