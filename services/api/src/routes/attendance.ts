import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const sessionCreateSchema = z.object({
  session_date: z.string().date(),
  description: z.string().optional(),
  calendar_event_id: z.string().uuid().optional(),
});

const bulkRecordsSchema = z.object({
  records: z.array(
    z.object({
      user_id: z.string().uuid(),
      status: z.enum(['present', 'late', 'absent', 'excused']),
      notes: z.string().optional(),
    })
  ).min(1),
});

const selfReportSchema = z.object({
  status: z.enum(['present', 'late', 'absent', 'excused']),
});

export async function attendanceRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Sessions ──────────────────────────────────────────────────────────────

  fastify.get('/:moduleId/sessions', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows } = await pool.query(
      `SELECT s.*, u.display_name AS created_by_name
       FROM attendance_sessions s
       LEFT JOIN users u ON u.user_id = s.created_by
       WHERE s.module_id = $1 AND s.tenant_id = $2
       ORDER BY s.session_date DESC`,
      [moduleId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:moduleId/sessions', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = sessionCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;
    const { rows } = await pool.query(
      `INSERT INTO attendance_sessions (module_id, tenant_id, session_date, description, calendar_event_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [moduleId, request.tenantId, d.session_date, d.description ?? null, d.calendar_event_id ?? null, request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  // ── Records ───────────────────────────────────────────────────────────────

  fastify.get('/:moduleId/sessions/:sessionId/records', async (request, reply) => {
    const { moduleId, sessionId } = request.params as { moduleId: string; sessionId: string };
    const { rows: sessions } = await pool.query(
      `SELECT session_id FROM attendance_sessions WHERE session_id = $1 AND module_id = $2 AND tenant_id = $3`,
      [sessionId, moduleId, request.tenantId]
    );
    if (sessions.length === 0) throw NotFound('Session not found');

    const { rows } = await pool.query(
      `SELECT r.*, u.display_name, u.email
       FROM attendance_records r
       JOIN users u ON u.user_id = r.user_id
       WHERE r.session_id = $1 AND r.tenant_id = $2
       ORDER BY u.display_name`,
      [sessionId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.put('/:moduleId/sessions/:sessionId/records', async (request, reply) => {
    const { moduleId, sessionId } = request.params as { moduleId: string; sessionId: string };
    const body = bulkRecordsSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: sessions } = await pool.query(
      `SELECT session_id FROM attendance_sessions WHERE session_id = $1 AND module_id = $2 AND tenant_id = $3`,
      [sessionId, moduleId, request.tenantId]
    );
    if (sessions.length === 0) throw NotFound('Session not found');

    const upserted: unknown[] = [];
    for (const rec of body.data.records) {
      const { rows } = await pool.query(
        `INSERT INTO attendance_records (session_id, tenant_id, user_id, status, recorded_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (session_id, user_id) DO UPDATE SET
           status      = EXCLUDED.status,
           recorded_by = EXCLUDED.recorded_by,
           notes       = EXCLUDED.notes,
           updated_at  = now()
         RETURNING *`,
        [sessionId, request.tenantId, rec.user_id, rec.status, request.user.sub, rec.notes ?? null]
      );
      upserted.push(rows[0]);
    }

    return reply.send({ data: upserted });
  });

  // ── Self-report ───────────────────────────────────────────────────────────

  fastify.post('/:moduleId/sessions/:sessionId/self', async (request, reply) => {
    const { moduleId, sessionId } = request.params as { moduleId: string; sessionId: string };
    const body = selfReportSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: sessions } = await pool.query(
      `SELECT session_id FROM attendance_sessions WHERE session_id = $1 AND module_id = $2 AND tenant_id = $3`,
      [sessionId, moduleId, request.tenantId]
    );
    if (sessions.length === 0) throw NotFound('Session not found');

    const { rows } = await pool.query(
      `INSERT INTO attendance_records (session_id, tenant_id, user_id, status, recorded_by)
       VALUES ($1, $2, $3, $4, $3)
       ON CONFLICT (session_id, user_id) DO UPDATE SET
         status     = EXCLUDED.status,
         updated_at = now()
       RETURNING *`,
      [sessionId, request.tenantId, request.user.sub, body.data.status]
    );
    return reply.status(200).send(rows[0]);
  });

  // ── Summary ───────────────────────────────────────────────────────────────

  fastify.get('/:moduleId/summary', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows: sessions } = await pool.query(
      `SELECT COUNT(*) AS total_sessions
       FROM attendance_sessions WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    const totalSessions = parseInt(sessions[0].total_sessions, 10);

    const { rows } = await pool.query(
      `SELECT r.user_id, u.display_name, u.email,
              COUNT(*) FILTER (WHERE r.status = 'present')  AS present,
              COUNT(*) FILTER (WHERE r.status = 'late')     AS late,
              COUNT(*) FILTER (WHERE r.status = 'absent')   AS absent,
              COUNT(*) FILTER (WHERE r.status = 'excused')  AS excused,
              COUNT(*) AS total_recorded
       FROM attendance_records r
       JOIN attendance_sessions s ON s.session_id = r.session_id
       JOIN users u ON u.user_id = r.user_id
       WHERE s.module_id = $1 AND r.tenant_id = $2
       GROUP BY r.user_id, u.display_name, u.email
       ORDER BY u.display_name`,
      [moduleId, request.tenantId]
    );

    return reply.send({
      total_sessions: totalSessions,
      data: rows.map((r) => ({
        ...r,
        present: parseInt(r.present, 10),
        late: parseInt(r.late, 10),
        absent: parseInt(r.absent, 10),
        excused: parseInt(r.excused, 10),
        total_recorded: parseInt(r.total_recorded, 10),
      })),
    });
  });
}
