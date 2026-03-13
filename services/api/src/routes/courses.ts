import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const courseSchema = z.object({
  course_code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(['private', 'tenant', 'public']).default('private'),
  status: z.enum(['draft', 'published']).default('draft'),
  term_id: z.string().uuid().optional(),
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
    const { cursor, limit = 20, status } = request.query as { cursor?: string; limit?: number; status?: string };
    const params: unknown[] = [request.tenantId, Math.min(Number(limit), 100)];
    let query = `SELECT course_id, tenant_id, course_code, title, description, visibility, status, published_at, term_id, created_by, created_at, updated_at, archived_at FROM courses WHERE tenant_id = $1 AND archived_at IS NULL`;
    if (status) { query += ` AND status = $${params.length + 1}`; params.push(status); }
    if (cursor) { query += ` AND course_id > $${params.length + 1}`; params.push(cursor); }
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
      `INSERT INTO courses (tenant_id, course_code, title, description, visibility, status, term_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [request.tenantId, body.data.course_code, body.data.title, body.data.description, body.data.visibility, body.data.status, body.data.term_id ?? null, request.user.sub]
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
    if (d.status !== undefined) { fields.push(`status = $${i++}`); values.push(d.status); }
    if (d.term_id !== undefined) { fields.push(`term_id = $${i++}`); values.push(d.term_id); }
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

  // Publish
  fastify.post('/:id/publish', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `UPDATE courses SET status = 'published', published_at = now(), updated_at = now()
       WHERE course_id = $1 AND tenant_id = $2 AND archived_at IS NULL RETURNING *`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Course not found');
    await pool.query(
      `INSERT INTO outbox_events (tenant_id, topic, key, payload) VALUES ($1, $2, $3, $4)`,
      [request.tenantId, 'course.published', id, JSON.stringify({ course_id: id })]
    );
    return reply.send(rows[0]);
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

  // Module visibility and move
  fastify.post('/:id/modules/:moduleId/hide', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, moduleId } = request.params as { id: string; moduleId: string };
    const { rows } = await pool.query(
      `UPDATE course_modules SET hidden = TRUE WHERE module_id = $1 AND course_id = $2 AND tenant_id = $3 RETURNING *`,
      [moduleId, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Module not found');
    return reply.send(rows[0]);
  });

  fastify.post('/:id/modules/:moduleId/show', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, moduleId } = request.params as { id: string; moduleId: string };
    const { rows } = await pool.query(
      `UPDATE course_modules SET hidden = FALSE WHERE module_id = $1 AND course_id = $2 AND tenant_id = $3 RETURNING *`,
      [moduleId, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Module not found');
    return reply.send(rows[0]);
  });

  fastify.post('/:id/modules/:moduleId/move', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, moduleId } = request.params as { id: string; moduleId: string };
    const body = z.object({
      section_id: z.string().uuid().optional(),
      position: z.number().int().min(0),
    }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [`position = $1`];
    const values: unknown[] = [body.data.position];
    if (body.data.section_id !== undefined) { fields.push(`section_id = $${fields.length + 1}`); values.push(body.data.section_id); }
    values.push(moduleId, id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE course_modules SET ${fields.join(', ')} WHERE module_id = $${values.length - 2} AND course_id = $${values.length - 1} AND tenant_id = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Module not found');
    return reply.send(rows[0]);
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

  // Reconcile enrolments from cohort_sync methods
  fastify.post('/:id/enrolments/reconcile', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows: methods } = await pool.query(
      `SELECT * FROM enrolment_methods WHERE course_id = $1 AND tenant_id = $2 AND method_type = 'cohort_sync' AND active = TRUE`,
      [id, request.tenantId]
    );

    let added = 0;
    let suspended = 0;

    for (const method of methods) {
      const { rows: members } = await pool.query(
        `SELECT user_id FROM cohort_members WHERE cohort_id = $1`,
        [method.cohort_id]
      );
      for (const member of members) {
        const result = await pool.query(
          `INSERT INTO enrolments (tenant_id, course_id, user_id, role, status, cohort_id)
           VALUES ($1, $2, $3, $4, 'active', $5)
           ON CONFLICT (tenant_id, course_id, user_id) DO UPDATE SET status = 'active'
           RETURNING (xmax = 0) AS inserted`,
          [request.tenantId, id, member.user_id, method.default_role, method.cohort_id]
        );
        if (result.rows[0]?.inserted) added++;
      }

      if (method.create_group && method.cohort_id) {
        const { rows: cohortRows } = await pool.query(
          `SELECT code FROM cohorts WHERE cohort_id = $1`,
          [method.cohort_id]
        );
        if (cohortRows.length > 0) {
          await pool.query(
            `INSERT INTO course_groups (tenant_id, course_id, name, cohort_id)
             VALUES ($1, $2, $3, $4) ON CONFLICT (course_id, name) DO NOTHING`,
            [request.tenantId, id, cohortRows[0].code, method.cohort_id]
          );
        }
      }
    }

    await pool.query(
      `INSERT INTO outbox_events (tenant_id, topic, key, payload) VALUES ($1, $2, $3, $4)`,
      [request.tenantId, 'enrolment.reconciled', id, JSON.stringify({ course_id: id, added, suspended })]
    );

    return reply.send({ course_id: id, added, suspended, methods_processed: methods.length });
  });

  // Groups
  fastify.get('/:id/groups', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM course_groups WHERE course_id = $1 AND tenant_id = $2 ORDER BY name`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/groups', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ name: z.string().min(1), cohort_id: z.string().uuid().optional() }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO course_groups (tenant_id, course_id, name, cohort_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [request.tenantId, id, body.data.name, body.data.cohort_id ?? null]
    );
    await pool.query(
      `INSERT INTO outbox_events (tenant_id, topic, key, payload) VALUES ($1, $2, $3, $4)`,
      [request.tenantId, 'group.created', rows[0].group_id, JSON.stringify(rows[0])]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.delete('/:id/groups/:groupId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, groupId } = request.params as { id: string; groupId: string };
    const { rowCount } = await pool.query(
      `DELETE FROM course_groups WHERE group_id = $1 AND course_id = $2 AND tenant_id = $3`,
      [groupId, id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Group not found');
    return reply.status(204).send();
  });

  // Groupings
  fastify.get('/:id/groupings', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT cg.*, COALESCE(
         json_agg(DISTINCT jsonb_build_object('group_id', g.group_id, 'name', g.name))
         FILTER (WHERE g.group_id IS NOT NULL), '[]'
       ) AS groups
       FROM course_groupings cg
       LEFT JOIN course_grouping_groups cgg ON cgg.grouping_id = cg.grouping_id
       LEFT JOIN course_groups g ON g.group_id = cgg.group_id
       WHERE cg.course_id = $1 AND cg.tenant_id = $2
       GROUP BY cg.grouping_id ORDER BY cg.name`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/groupings', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ name: z.string().min(1) }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO course_groupings (tenant_id, course_id, name) VALUES ($1, $2, $3) RETURNING *`,
      [request.tenantId, id, body.data.name]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.post('/:id/groupings/:groupingId/groups', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { groupingId } = request.params as { id: string; groupingId: string };
    const body = z.object({ group_ids: z.array(z.string().uuid()).min(1) }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    await pool.query(
      `INSERT INTO course_grouping_groups (grouping_id, group_id)
       SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
      [groupingId, body.data.group_ids]
    );
    return reply.status(201).send({ grouping_id: groupingId, group_ids: body.data.group_ids });
  });

  fastify.delete('/:id/groupings/:groupingId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, groupingId } = request.params as { id: string; groupingId: string };
    const { rowCount } = await pool.query(
      `DELETE FROM course_groupings WHERE grouping_id = $1 AND course_id = $2 AND tenant_id = $3`,
      [groupingId, id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Grouping not found');
    return reply.status(204).send();
  });

  // Enrolment Methods
  fastify.get('/:id/enrolment-methods', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM enrolment_methods WHERE course_id = $1 AND tenant_id = $2 ORDER BY created_at`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:id/enrolment-methods', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      method_type: z.enum(['manual', 'cohort_sync']),
      cohort_id: z.string().uuid().optional(),
      default_role: z.enum(['student', 'teacher', 'ta', 'observer']).default('student'),
      create_group: z.boolean().default(false),
    }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO enrolment_methods (tenant_id, course_id, method_type, cohort_id, default_role, create_group)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (course_id, method_type, cohort_id) DO UPDATE SET active = TRUE, default_role = EXCLUDED.default_role
       RETURNING *`,
      [request.tenantId, id, body.data.method_type, body.data.cohort_id ?? null, body.data.default_role, body.data.create_group]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.delete('/:id/enrolment-methods/:methodId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, methodId } = request.params as { id: string; methodId: string };
    const { rowCount } = await pool.query(
      `DELETE FROM enrolment_methods WHERE method_id = $1 AND course_id = $2 AND tenant_id = $3`,
      [methodId, id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Enrolment method not found');
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

