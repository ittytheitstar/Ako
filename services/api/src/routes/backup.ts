import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const copyJobCreateSchema = z.object({
  title: z.string().min(1),
  course_code: z.string().min(1),
  options: z.object({
    include_content: z.boolean().optional().default(true),
    include_assessments: z.boolean().optional().default(true),
    include_gradebook: z.boolean().optional().default(true),
    include_forums: z.boolean().optional().default(true),
    include_completion: z.boolean().optional().default(true),
    include_calendar: z.boolean().optional().default(true),
    include_cohorts: z.boolean().optional().default(false),
  }).optional().default({}),
});

const promoteSchema = z.object({
  template_category: z.string().optional(),
  template_tags: z.array(z.string()).optional().default([]),
  template_description: z.string().optional(),
});

const backupOptionsSchema = z.object({
  include_files: z.boolean().optional().default(false),
  include_submissions: z.boolean().optional().default(false),
});

const restoreOptionsSchema = z.object({
  title: z.string().min(1).optional(),
  course_code: z.string().min(1).optional(),
});

async function cloneCourse(
  tenantId: string,
  sourceCourseId: string,
  title: string,
  courseCode: string,
  createdBy: string
): Promise<string> {
  const { rows: newCourseRows } = await pool.query(
    `INSERT INTO courses (tenant_id, course_code, title, description, visibility, status, term_id, created_by)
     SELECT $1, $2, $3, description, visibility, 'draft', term_id, $4
     FROM courses WHERE course_id = $5
     RETURNING course_id`,
    [tenantId, courseCode, title, createdBy, sourceCourseId]
  );
  const targetCourseId: string = newCourseRows[0].course_id;

  const { rows: sectionRows } = await pool.query(
    `SELECT * FROM course_sections WHERE course_id = $1 AND tenant_id = $2 ORDER BY position`,
    [sourceCourseId, tenantId]
  );
  const sectionIdMap = new Map<string, string>();
  for (const sec of sectionRows) {
    const { rows: newSecRows } = await pool.query(
      `INSERT INTO course_sections (tenant_id, course_id, title, position, summary)
       VALUES ($1, $2, $3, $4, $5) RETURNING section_id`,
      [tenantId, targetCourseId, sec.title, sec.position, sec.summary ?? null]
    );
    sectionIdMap.set(sec.section_id as string, newSecRows[0].section_id as string);
  }

  const { rows: modRows } = await pool.query(
    `SELECT * FROM course_modules WHERE course_id = $1 AND tenant_id = $2`,
    [sourceCourseId, tenantId]
  );
  for (const mod of modRows) {
    const newSectionId = mod.section_id ? (sectionIdMap.get(mod.section_id as string) ?? null) : null;
    await pool.query(
      `INSERT INTO course_modules (tenant_id, course_id, section_id, module_type, title, settings, availability)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, targetCourseId, newSectionId, mod.module_type, mod.title,
       JSON.stringify(mod.settings ?? {}), JSON.stringify(mod.availability ?? {})]
    );
  }

  return targetCourseId;
}

/**
 * Routes registered under /api/v1/courses
 */
export async function courseCopyRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Course Copy ──────────────────────────────────────────────────────────

  fastify.post('/:id/copy', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = copyJobCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: courseRows } = await pool.query(
      `SELECT course_id FROM courses WHERE course_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (courseRows.length === 0) throw NotFound('Source course not found');

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
      const targetCourseId = await cloneCourse(
        request.tenantId, id, body.data.title, body.data.course_code, request.user.sub
      );
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

  // ── Course Templates (promote / demote) ──────────────────────────────────

  fastify.post('/:id/promote-template', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = promoteSchema.safeParse(request.body ?? {});
    if (!body.success) throw BadRequest(body.error.message);

    const { rows } = await pool.query(
      `UPDATE courses
       SET is_template = true, template_category = $1, template_tags = $2,
           template_description = $3, updated_at = now()
       WHERE course_id = $4 AND tenant_id = $5 RETURNING *`,
      [body.data.template_category ?? null, body.data.template_tags,
       body.data.template_description ?? null, id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Course not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id/demote-template', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `UPDATE courses
       SET is_template = false, template_category = NULL, template_tags = '{}',
           template_description = NULL, updated_at = now()
       WHERE course_id = $1 AND tenant_id = $2 RETURNING *`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Course not found');
    return reply.status(200).send(rows[0]);
  });

  // ── Backup ────────────────────────────────────────────────────────────────

  fastify.post('/:id/backup', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = backupOptionsSchema.safeParse(request.body ?? {});
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: courseRows } = await pool.query(
      `SELECT course_id FROM courses WHERE course_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (courseRows.length === 0) throw NotFound('Course not found');

    const { rows } = await pool.query(
      `INSERT INTO backup_jobs (tenant_id, course_id, options, status, created_by)
       VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
      [request.tenantId, id, JSON.stringify(body.data), request.user.sub]
    );
    const jobId: string = rows[0].job_id;

    await pool.query(`UPDATE backup_jobs SET status = 'running' WHERE job_id = $1`, [jobId]);
    try {
      const filePath = `/backups/${request.tenantId}/${id}/${jobId}.zip`;
      await pool.query(
        `UPDATE backup_jobs SET status = 'complete', file_path = $1, file_size_bytes = 0, completed_at = now() WHERE job_id = $2`,
        [filePath, jobId]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await pool.query(
        `UPDATE backup_jobs SET status = 'failed', error_message = $1 WHERE job_id = $2`,
        [message, jobId]
      );
    }

    const { rows: jobRows } = await pool.query(`SELECT * FROM backup_jobs WHERE job_id = $1`, [jobId]);
    return reply.status(202).send(jobRows[0]);
  });

  // ── Restore ───────────────────────────────────────────────────────────────

  // POST /courses/restore — restore into a new course
  fastify.post('/restore', async (request, reply) => {
    const body = restoreOptionsSchema.safeParse(request.body ?? {});
    if (!body.success) throw BadRequest(body.error.message);

    const { rows } = await pool.query(
      `INSERT INTO restore_jobs (tenant_id, options, status, created_by)
       VALUES ($1, $2, 'pending', $3) RETURNING *`,
      [request.tenantId, JSON.stringify(body.data), request.user.sub]
    );
    const jobId: string = rows[0].job_id;
    await pool.query(`UPDATE restore_jobs SET status = 'running' WHERE job_id = $1`, [jobId]);

    try {
      const title = body.data.title ?? 'Restored Course';
      const courseCode = body.data.course_code ?? `RESTORE-${Date.now()}`;
      const { rows: courseRows } = await pool.query(
        `INSERT INTO courses (tenant_id, course_code, title, visibility, status, created_by)
         VALUES ($1, $2, $3, 'tenant', 'draft', $4) RETURNING course_id`,
        [request.tenantId, courseCode, title, request.user.sub]
      );
      const targetCourseId: string = courseRows[0].course_id;
      await pool.query(
        `UPDATE restore_jobs SET status = 'complete', target_course_id = $1, completed_at = now() WHERE job_id = $2`,
        [targetCourseId, jobId]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await pool.query(
        `UPDATE restore_jobs SET status = 'failed', error_message = $1 WHERE job_id = $2`,
        [message, jobId]
      );
    }

    const { rows: jobRows } = await pool.query(`SELECT * FROM restore_jobs WHERE job_id = $1`, [jobId]);
    return reply.status(202).send(jobRows[0]);
  });

  // POST /courses/:id/restore — restore into an existing course
  fastify.post('/:id/restore', async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows: courseRows } = await pool.query(
      `SELECT course_id FROM courses WHERE course_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (courseRows.length === 0) throw NotFound('Target course not found');

    const { rows } = await pool.query(
      `INSERT INTO restore_jobs (tenant_id, target_course_id, options, status, created_by)
       VALUES ($1, $2, '{}', 'pending', $3) RETURNING *`,
      [request.tenantId, id, request.user.sub]
    );
    const jobId: string = rows[0].job_id;
    await pool.query(
      `UPDATE restore_jobs SET status = 'complete', completed_at = now() WHERE job_id = $1`,
      [jobId]
    );

    const { rows: jobRows } = await pool.query(`SELECT * FROM restore_jobs WHERE job_id = $1`, [jobId]);
    return reply.status(202).send(jobRows[0]);
  });
}

/**
 * Routes registered under /api/v1 (job status endpoints)
 */
export async function backupJobRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Copy Jobs ─────────────────────────────────────────────────────────────

  fastify.get('/copy-jobs', async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT j.*, sc.title AS source_course_title, tc.title AS target_course_title
       FROM copy_jobs j
       LEFT JOIN courses sc ON sc.course_id = j.source_course_id
       LEFT JOIN courses tc ON tc.course_id = j.target_course_id
       WHERE j.tenant_id = $1 AND j.created_by = $2
       ORDER BY j.created_at DESC`,
      [request.tenantId, request.user.sub]
    );
    return reply.send({ data: rows });
  });

  fastify.get('/copy-jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { rows } = await pool.query(
      `SELECT j.*, sc.title AS source_course_title, tc.title AS target_course_title
       FROM copy_jobs j
       LEFT JOIN courses sc ON sc.course_id = j.source_course_id
       LEFT JOIN courses tc ON tc.course_id = j.target_course_id
       WHERE j.job_id = $1 AND j.tenant_id = $2`,
      [jobId, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Copy job not found');
    return reply.send(rows[0]);
  });

  // ── Backup Jobs ───────────────────────────────────────────────────────────

  fastify.get('/backup-jobs', async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT j.*, c.title AS course_title
       FROM backup_jobs j LEFT JOIN courses c ON c.course_id = j.course_id
       WHERE j.tenant_id = $1 ORDER BY j.created_at DESC`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.get('/backup-jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { rows } = await pool.query(
      `SELECT j.*, c.title AS course_title
       FROM backup_jobs j LEFT JOIN courses c ON c.course_id = j.course_id
       WHERE j.job_id = $1 AND j.tenant_id = $2`,
      [jobId, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Backup job not found');
    return reply.send(rows[0]);
  });

  fastify.get('/backup-jobs/:jobId/download', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { rows } = await pool.query(
      `SELECT * FROM backup_jobs WHERE job_id = $1 AND tenant_id = $2`,
      [jobId, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Backup job not found');
    if (rows[0].status !== 'complete') throw BadRequest('Backup is not yet complete');
    return reply.send({ file_path: rows[0].file_path, file_size_bytes: rows[0].file_size_bytes });
  });

  // ── Restore Jobs ──────────────────────────────────────────────────────────

  fastify.get('/restore-jobs', async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT j.*, c.title AS target_course_title
       FROM restore_jobs j LEFT JOIN courses c ON c.course_id = j.target_course_id
       WHERE j.tenant_id = $1 ORDER BY j.created_at DESC`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.get('/restore-jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { rows } = await pool.query(
      `SELECT j.*, c.title AS target_course_title
       FROM restore_jobs j LEFT JOIN courses c ON c.course_id = j.target_course_id
       WHERE j.job_id = $1 AND j.tenant_id = $2`,
      [jobId, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Restore job not found');
    return reply.send(rows[0]);
  });
}
