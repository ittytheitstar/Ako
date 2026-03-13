import { FastifyInstance } from 'fastify';
import { pool } from '../db/client';

export async function reportRoutes(fastify: FastifyInstance) {
  // Enrolments report: counts per course
  fastify.get('/enrolments', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id } = request.query as { course_id?: string };
    const params: unknown[] = [request.tenantId];
    let filter = '';
    if (course_id) { filter = ` AND c.course_id = $2`; params.push(course_id); }

    const { rows } = await pool.query(
      `SELECT
         c.course_id,
         c.course_code,
         c.title,
         COUNT(e.enrolment_id) AS total_enrolments,
         COUNT(e.enrolment_id) FILTER (WHERE e.status = 'active') AS active_enrolments,
         COUNT(e.enrolment_id) FILTER (WHERE e.status = 'completed') AS completed_enrolments,
         COUNT(e.enrolment_id) FILTER (WHERE e.status = 'suspended') AS suspended_enrolments
       FROM courses c
       LEFT JOIN enrolments e ON e.course_id = c.course_id AND e.tenant_id = c.tenant_id
       WHERE c.tenant_id = $1${filter}
       GROUP BY c.course_id, c.course_code, c.title
       ORDER BY c.title`,
      params
    );
    return reply.send({ data: rows });
  });

  // Activity report: forum posts + assignment submissions per course
  fastify.get('/activity', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id } = request.query as { course_id?: string };
    const params: unknown[] = [request.tenantId];
    let filter = '';
    if (course_id) { filter = ` AND c.course_id = $2`; params.push(course_id); }

    const { rows } = await pool.query(
      `SELECT
         c.course_id,
         c.course_code,
         c.title,
         COUNT(DISTINCT fp.post_id) AS total_posts,
         COUNT(DISTINCT asub.submission_id) AS total_submissions,
         COUNT(DISTINCT CASE WHEN fp.post_id IS NOT NULL OR asub.submission_id IS NOT NULL
                             THEN COALESCE(fp.author_id, asub.user_id) END) AS active_learners
       FROM courses c
       LEFT JOIN forums f ON f.course_id = c.course_id
       LEFT JOIN forum_threads ft ON ft.forum_id = f.forum_id
       LEFT JOIN forum_posts fp ON fp.thread_id = ft.thread_id AND fp.deleted_at IS NULL
       LEFT JOIN course_modules cm ON cm.course_id = c.course_id AND cm.module_type = 'assignment'
       LEFT JOIN assignments a ON a.module_id = cm.module_id
       LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.assignment_id
       WHERE c.tenant_id = $1${filter}
       GROUP BY c.course_id, c.course_code, c.title
       ORDER BY c.title`,
      params
    );
    return reply.send({ data: rows });
  });

  // Completion report: enrolment status = completed vs total
  fastify.get('/completion', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id } = request.query as { course_id?: string };
    const params: unknown[] = [request.tenantId];
    let filter = '';
    if (course_id) { filter = ` AND c.course_id = $2`; params.push(course_id); }

    const { rows } = await pool.query(
      `SELECT
         c.course_id,
         c.course_code,
         c.title,
         COUNT(e.enrolment_id) AS total_enrolments,
         COUNT(e.enrolment_id) FILTER (WHERE e.status = 'completed') AS completed_count,
         CASE WHEN COUNT(e.enrolment_id) > 0
              THEN ROUND(100.0 * COUNT(e.enrolment_id) FILTER (WHERE e.status = 'completed')
                         / COUNT(e.enrolment_id), 2)
              ELSE 0 END AS completion_rate
       FROM courses c
       LEFT JOIN enrolments e ON e.course_id = c.course_id AND e.tenant_id = c.tenant_id
       WHERE c.tenant_id = $1${filter}
       GROUP BY c.course_id, c.course_code, c.title
       ORDER BY c.title`,
      params
    );
    return reply.send({ data: rows });
  });

  // Forum engagement report
  fastify.get('/forum-engagement', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { course_id } = request.query as { course_id?: string };
    const params: unknown[] = [request.tenantId];
    let filter = '';
    if (course_id) { filter = ` AND c.course_id = $2`; params.push(course_id); }

    const { rows } = await pool.query(
      `SELECT
         c.course_id,
         c.course_code,
         c.title,
         COUNT(DISTINCT f.forum_id) AS total_forums,
         COUNT(DISTINCT ft.thread_id) AS total_threads,
         COUNT(DISTINCT fp.post_id) AS total_posts,
         COUNT(DISTINCT fp.author_id) AS unique_contributors
       FROM courses c
       LEFT JOIN forums f ON f.course_id = c.course_id
       LEFT JOIN forum_threads ft ON ft.forum_id = f.forum_id
       LEFT JOIN forum_posts fp ON fp.thread_id = ft.thread_id AND fp.deleted_at IS NULL
       WHERE c.tenant_id = $1${filter}
       GROUP BY c.course_id, c.course_code, c.title
       ORDER BY c.title`,
      params
    );
    return reply.send({ data: rows });
  });
}
