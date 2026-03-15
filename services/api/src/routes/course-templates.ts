import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const createFromTemplateSchema = z.object({
  title: z.string().min(1),
  course_code: z.string().min(1),
  options: z.object({
    include_content: z.boolean().optional().default(true),
    include_assessments: z.boolean().optional().default(true),
    include_gradebook: z.boolean().optional().default(true),
    include_forums: z.boolean().optional().default(true),
    include_completion: z.boolean().optional().default(true),
    include_calendar: z.boolean().optional().default(true),
  }).optional().default({}),
});

/**
 * Routes registered under /api/v1/course-templates
 */
export async function courseTemplateRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // GET /course-templates — list templates filterable by category, tag, q
  fastify.get('/', async (request, reply) => {
    const query = request.query as { category?: string; tag?: string; q?: string };
    let sql = `SELECT course_id, tenant_id, course_code, title, description,
                      is_template, template_category, template_tags, template_description,
                      created_at, updated_at
               FROM courses
               WHERE tenant_id = $1 AND is_template = true AND status != 'deleted'`;
    const params: unknown[] = [request.tenantId];

    if (query.category) {
      params.push(query.category);
      sql += ` AND template_category = $${params.length}`;
    }
    if (query.tag) {
      params.push(query.tag);
      sql += ` AND $${params.length} = ANY(template_tags)`;
    }
    if (query.q) {
      params.push(`%${query.q}%`);
      sql += ` AND (title ILIKE $${params.length} OR template_description ILIKE $${params.length})`;
    }
    sql += ' ORDER BY title';

    const { rows } = await pool.query(sql, params);
    return reply.send({ data: rows });
  });

  // POST /course-templates/:id/create-course — create a course from a template
  fastify.post('/:id/create-course', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createFromTemplateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: tmplRows } = await pool.query(
      `SELECT course_id FROM courses WHERE course_id = $1 AND tenant_id = $2 AND is_template = true`,
      [id, request.tenantId]
    );
    if (tmplRows.length === 0) throw NotFound('Template not found');

    const { rows } = await pool.query(
      `INSERT INTO copy_jobs (tenant_id, source_course_id, options, status, created_by)
       VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
      [request.tenantId, id,
       JSON.stringify({ title: body.data.title, course_code: body.data.course_code, ...body.data.options }),
       request.user.sub]
    );
    const jobId: string = rows[0].job_id;
    await pool.query(`UPDATE copy_jobs SET status = 'running' WHERE job_id = $1`, [jobId]);

    try {
      const { rows: newCourseRows } = await pool.query(
        `INSERT INTO courses (tenant_id, course_code, title, description, visibility, status, created_by)
         SELECT $1, $2, $3, description, visibility, 'draft', $4
         FROM courses WHERE course_id = $5 RETURNING course_id`,
        [request.tenantId, body.data.course_code, body.data.title, request.user.sub, id]
      );
      const targetCourseId: string = newCourseRows[0].course_id;

      const { rows: sectionRows } = await pool.query(
        `SELECT * FROM course_sections WHERE course_id = $1 AND tenant_id = $2 ORDER BY position`,
        [id, request.tenantId]
      );
      const sectionIdMap = new Map<string, string>();
      for (const sec of sectionRows) {
        const { rows: newSecRows } = await pool.query(
          `INSERT INTO course_sections (tenant_id, course_id, title, position, summary)
           VALUES ($1, $2, $3, $4, $5) RETURNING section_id`,
          [request.tenantId, targetCourseId, sec.title, sec.position, sec.summary ?? null]
        );
        sectionIdMap.set(sec.section_id as string, newSecRows[0].section_id as string);
      }

      const { rows: modRows } = await pool.query(
        `SELECT * FROM course_modules WHERE course_id = $1 AND tenant_id = $2`,
        [id, request.tenantId]
      );
      for (const mod of modRows) {
        const newSectionId = mod.section_id ? (sectionIdMap.get(mod.section_id as string) ?? null) : null;
        await pool.query(
          `INSERT INTO course_modules (tenant_id, course_id, section_id, module_type, title, settings, availability)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [request.tenantId, targetCourseId, newSectionId, mod.module_type, mod.title,
           JSON.stringify(mod.settings ?? {}), JSON.stringify(mod.availability ?? {})]
        );
      }

      await pool.query(
        `UPDATE copy_jobs SET status = 'complete', target_course_id = $1, completed_at = now() WHERE job_id = $2`,
        [targetCourseId, jobId]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await pool.query(
        `UPDATE copy_jobs SET status = 'failed', error_message = $1 WHERE job_id = $2`,
        [message, jobId]
      );
    }

    const { rows: jobRows } = await pool.query(`SELECT * FROM copy_jobs WHERE job_id = $1`, [jobId]);
    return reply.status(202).send(jobRows[0]);
  });
}
