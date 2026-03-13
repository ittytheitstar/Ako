import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';
import { publishEvent } from '../events/publisher';
import { randomUUID } from 'crypto';

const announcementSchema = z.object({
  title: z.string().min(1),
  body: z.record(z.unknown()),
  channel: z.enum(['course', 'cohort', 'system']).default('course'),
  cohort_id: z.string().uuid().optional(),
  scheduled_at: z.string().optional(),
});

export async function announcementRoutes(fastify: FastifyInstance) {
  // GET /courses/:courseId/announcements
  fastify.get('/courses/:courseId/announcements', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const { cursor, limit = 20 } = request.query as { cursor?: string; limit?: number };
    const params: unknown[] = [courseId, request.tenantId, Math.min(Number(limit), 100)];
    let query = `SELECT * FROM announcements WHERE course_id = $1 AND tenant_id = $2 AND (published_at IS NOT NULL OR scheduled_at IS NULL OR scheduled_at <= now())`;
    if (cursor) { query += ` AND announcement_id < $4`; params.push(cursor); }
    query += ` ORDER BY created_at DESC LIMIT $3`;
    const { rows } = await pool.query(query, params);
    return reply.send({
      data: rows,
      nextCursor: rows.length === Number(limit) ? rows[rows.length - 1].announcement_id : undefined,
    });
  });

  // POST /courses/:courseId/announcements
  fastify.post('/courses/:courseId/announcements', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const body = announcementSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const publishNow = !body.data.scheduled_at;
    const { rows } = await pool.query(
      `INSERT INTO announcements (tenant_id, course_id, cohort_id, author_id, title, body, channel, scheduled_at, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        request.tenantId,
        courseId,
        body.data.cohort_id ?? null,
        request.user.sub,
        body.data.title,
        JSON.stringify(body.data.body),
        body.data.channel,
        body.data.scheduled_at ?? null,
        publishNow ? new Date().toISOString() : null,
      ]
    );
    const announcement = rows[0];

    if (publishNow) {
      // Fan-out: create notifications for all enrolled users in this course
      const { rows: enrolled } = await pool.query(
        `SELECT user_id FROM enrolments WHERE course_id = $1 AND tenant_id = $2 AND status = 'active' AND user_id != $3`,
        [courseId, request.tenantId, request.user.sub]
      );
      for (const enr of enrolled) {
        await pool.query(
          `INSERT INTO notifications (tenant_id, user_id, kind, payload)
           VALUES ($1, $2, 'announcement', $3)`,
          [request.tenantId, enr.user_id, JSON.stringify({
            announcement_id: announcement.announcement_id,
            course_id: courseId,
            title: body.data.title,
          })]
        );
      }

      // Publish outbox event
      await pool.query(
        `INSERT INTO outbox_events (tenant_id, topic, key, payload)
         VALUES ($1, 'announcement.published', $2, $3)`,
        [request.tenantId, `course:${courseId}`, JSON.stringify({
          announcement_id: announcement.announcement_id,
          course_id: courseId,
          title: body.data.title,
          author_id: request.user.sub,
        })]
      );

      await publishEvent({
        eventId: randomUUID(),
        type: 'course.updated',
        tenantId: request.tenantId,
        channel: `course:${courseId}`,
        data: { kind: 'announcement', announcement_id: announcement.announcement_id, title: body.data.title },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(201).send(announcement);
  });

  // GET /announcements/:id
  fastify.get('/announcements/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM announcements WHERE announcement_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Announcement not found');
    return reply.send(rows[0]);
  });

  // PATCH /announcements/:id
  fastify.patch('/announcements/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = announcementSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const d = body.data;
    if (d.title !== undefined) { fields.push(`title = $${i++}`); values.push(d.title); }
    if (d.body !== undefined) { fields.push(`body = $${i++}`); values.push(JSON.stringify(d.body)); }
    if (d.scheduled_at !== undefined) { fields.push(`scheduled_at = $${i++}`); values.push(d.scheduled_at); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE announcements SET ${fields.join(', ')}
       WHERE announcement_id = $${i} AND tenant_id = $${i + 1} AND author_id = $${i + 2} RETURNING *`,
      [...values, request.user.sub]
    );
    if (rows.length === 0) throw NotFound('Announcement not found');
    return reply.send(rows[0]);
  });

  // DELETE /announcements/:id
  fastify.delete('/announcements/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM announcements WHERE announcement_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Announcement not found');
    return reply.status(204).send();
  });
}
