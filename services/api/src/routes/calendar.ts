import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';
import * as crypto from 'crypto';

const ONE_DAY_MINUTES = 1440;
const THREE_DAYS_MINUTES = 4320;
const ONE_WEEK_MINUTES = 10080;
const DEFAULT_REMINDER_INTERVALS = [ONE_DAY_MINUTES, THREE_DAYS_MINUTES, ONE_WEEK_MINUTES];

const eventCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime().optional(),
  all_day: z.boolean().default(false),
  recurrence_rule: z.string().optional(),
  recurrence_exceptions: z.array(z.string().datetime()).default([]),
  context_type: z.enum(['course', 'cohort', 'system']).default('system'),
  context_id: z.string().uuid().optional(),
  visibility: z.enum(['public', 'grouping', 'private']).default('public'),
  grouping_id: z.string().uuid().optional(),
});

const eventUpdateSchema = eventCreateSchema.partial().extend({
  recurrence_scope: z.enum(['single', 'following', 'all']).optional(),
  occurrence_date: z.string().datetime().optional(),
});

const reminderPrefSchema = z.object({
  event_type: z.string().min(1),
  enabled: z.boolean().default(true),
  intervals: z.array(z.number().int().positive()).default(DEFAULT_REMINDER_INTERVALS),
});

const externalSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  sync_interval_minutes: z.number().int().positive().default(60),
  active: z.boolean().default(true),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateIcalToken(userId: string, tenantId: string, secret: string): string {
  const expiry = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const payload = `${userId}:${tenantId}:${expiry}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyIcalToken(token: string, secret: string): { userId: string; tenantId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [userId, tenantId, expiry, sig] = parts;
    const payload = `${userId}:${tenantId}:${expiry}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (sig !== expected) return null;
    if (parseInt(expiry, 10) < Math.floor(Date.now() / 1000)) return null;
    return { userId, tenantId };
  } catch {
    return null;
  }
}

function eventsToIcal(events: Record<string, unknown>[], baseUrl: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ako LMS//Ako//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const ev of events) {
    const start = ev.start_at as string;
    const end = (ev.end_at as string) ?? start;
    // Format as YYYYMMDD for all-day, or YYYYMMDDTHHmmssZ for timed events
    const toIcalDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '');
    const toIcalDateTime = (iso: string) =>
      new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const startStr = ev.all_day
      ? `DTSTART;VALUE=DATE:${toIcalDate(start)}`
      : `DTSTART:${toIcalDateTime(start)}`;
    const endStr = ev.all_day
      ? `DTEND;VALUE=DATE:${toIcalDate(end)}`
      : `DTEND:${toIcalDateTime(end)}`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.event_id}@ako`);
    lines.push(startStr);
    lines.push(endStr);
    lines.push(`SUMMARY:${(ev.title as string).replace(/\n/g, '\\n')}`);
    if (ev.description) lines.push(`DESCRIPTION:${(ev.description as string).replace(/\n/g, '\\n')}`);
    if (ev.recurrence_rule) lines.push(`RRULE:${ev.recurrence_rule}`);
    lines.push(`URL:${baseUrl}/dashboard/calendar`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export async function calendarRoutes(fastify: FastifyInstance) {
  const icalSecret = process.env.ICAL_TOKEN_SECRET;
  if (!icalSecret) {
    fastify.log.warn('ICAL_TOKEN_SECRET is not set; iCal token generation is using an insecure default. Set ICAL_TOKEN_SECRET in production.');
  }
  const resolvedIcalSecret = icalSecret ?? 'ako-ical-secret-dev-only';
  const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';

  const DEFAULT_EVENT_LIMIT = 200;
  const MAX_EVENT_LIMIT = 500;

  // ── Calendar Events ────────────────────────────────────────────────────────

  fastify.get('/events', { preHandler: fastify.authenticate }, async (request, reply) => {
    const q = request.query as {
      from?: string; to?: string; context_type?: string; context_id?: string;
      source_type?: string; limit?: string; offset?: string;
    };
    const params: unknown[] = [request.tenantId];
    const conditions: string[] = ['e.tenant_id = $1'];

    if (q.from) { params.push(q.from); conditions.push(`e.start_at >= $${params.length}`); }
    if (q.to) { params.push(q.to); conditions.push(`e.start_at <= $${params.length}`); }
    if (q.context_type) { params.push(q.context_type); conditions.push(`e.context_type = $${params.length}`); }
    if (q.context_id) { params.push(q.context_id); conditions.push(`e.context_id = $${params.length}`); }
    if (q.source_type) { params.push(q.source_type); conditions.push(`e.source_type = $${params.length}`); }

    const limit = Math.min(parseInt(q.limit ?? String(DEFAULT_EVENT_LIMIT), 10), MAX_EVENT_LIMIT);
    const offset = parseInt(q.offset ?? '0', 10);

    const { rows } = await pool.query(
      `SELECT e.*, u.display_name AS created_by_name
       FROM calendar_events e
       LEFT JOIN users u ON u.user_id = e.created_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.start_at
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return reply.send({ data: rows, total: rows.length });
  });

  fastify.post('/events', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = eventCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;
    const { rows } = await pool.query(
      `INSERT INTO calendar_events
         (tenant_id, title, description, start_at, end_at, all_day, recurrence_rule,
          recurrence_exceptions, context_type, context_id, visibility, grouping_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        request.tenantId, d.title, d.description ?? null, d.start_at, d.end_at ?? null,
        d.all_day, d.recurrence_rule ?? null, d.recurrence_exceptions,
        d.context_type, d.context_id ?? null, d.visibility, d.grouping_id ?? null,
        request.user.sub,
      ]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.get('/events/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT e.*, u.display_name AS created_by_name
       FROM calendar_events e
       LEFT JOIN users u ON u.user_id = e.created_by
       WHERE e.event_id = $1 AND e.tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Calendar event not found');
    return reply.send(rows[0]);
  });

  fastify.patch('/events/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = eventUpdateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;

    // Check event exists
    const { rows: existing } = await pool.query(
      `SELECT * FROM calendar_events WHERE event_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (existing.length === 0) throw NotFound('Calendar event not found');

    const ev = existing[0];
    const scope = d.recurrence_scope ?? 'all';

    // For single-occurrence edits on recurring events, add an exception
    if (ev.recurrence_rule && scope === 'single' && d.occurrence_date) {
      const exceptions = [...(ev.recurrence_exceptions ?? []), d.occurrence_date];
      await pool.query(
        `UPDATE calendar_events SET recurrence_exceptions = $1, updated_at = now()
         WHERE event_id = $2 AND tenant_id = $3`,
        [exceptions, id, request.tenantId]
      );
      // Create a one-off event for the modified occurrence
      const occStart = d.start_at ?? d.occurrence_date;
      const occEnd = d.end_at ?? null;
      const { rows: newRow } = await pool.query(
        `INSERT INTO calendar_events
           (tenant_id, title, description, start_at, end_at, all_day,
            context_type, context_id, visibility, grouping_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          request.tenantId,
          d.title ?? ev.title, d.description ?? ev.description,
          occStart, occEnd, d.all_day ?? ev.all_day,
          d.context_type ?? ev.context_type, d.context_id ?? ev.context_id,
          d.visibility ?? ev.visibility, d.grouping_id ?? ev.grouping_id,
          request.user.sub,
        ]
      );
      return reply.send(newRow[0]);
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];

    const fieldMap: Record<string, unknown> = {
      title: d.title, description: d.description, start_at: d.start_at,
      end_at: d.end_at, all_day: d.all_day, recurrence_rule: d.recurrence_rule,
      recurrence_exceptions: d.recurrence_exceptions, context_type: d.context_type,
      context_id: d.context_id, visibility: d.visibility, grouping_id: d.grouping_id,
    };

    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        params.push(val);
        setClauses.push(`${key} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) throw BadRequest('No fields to update');
    setClauses.push('updated_at = now()');
    params.push(id, request.tenantId);

    const { rows } = await pool.query(
      `UPDATE calendar_events SET ${setClauses.join(', ')}
       WHERE event_id = $${params.length - 1} AND tenant_id = $${params.length}
       RETURNING *`,
      params
    );
    return reply.send(rows[0]);
  });

  fastify.delete('/events/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { scope?: string; occurrence_date?: string };
    const scope = q.scope ?? 'all';

    const { rows: existing } = await pool.query(
      `SELECT * FROM calendar_events WHERE event_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (existing.length === 0) throw NotFound('Calendar event not found');

    const ev = existing[0];

    if (ev.recurrence_rule && scope === 'single' && q.occurrence_date) {
      // Add exception date instead of deleting
      const exceptions = [...(ev.recurrence_exceptions ?? []), q.occurrence_date];
      await pool.query(
        `UPDATE calendar_events SET recurrence_exceptions = $1, updated_at = now()
         WHERE event_id = $2 AND tenant_id = $3`,
        [exceptions, id, request.tenantId]
      );
      return reply.status(204).send();
    }

    if (ev.recurrence_rule && scope === 'following' && q.occurrence_date) {
      // Truncate the series by setting UNTIL
      const existingRrule = ev.recurrence_rule as string;
      const until = new Date(q.occurrence_date);
      until.setDate(until.getDate() - 1);
      const untilStr = until.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const newRrule = existingRrule.includes('UNTIL=')
        ? existingRrule.replace(/UNTIL=[^;]+/, `UNTIL=${untilStr}`)
        : `${existingRrule};UNTIL=${untilStr}`;
      await pool.query(
        `UPDATE calendar_events SET recurrence_rule = $1, updated_at = now()
         WHERE event_id = $2 AND tenant_id = $3`,
        [newRrule, id, request.tenantId]
      );
      return reply.status(204).send();
    }

    await pool.query(
      `DELETE FROM calendar_events WHERE event_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    return reply.status(204).send();
  });

  // ── Course Calendar ────────────────────────────────────────────────────────

  fastify.get('/courses/:courseId/calendar', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const q = request.query as { from?: string; to?: string };
    const params: unknown[] = [request.tenantId, courseId];
    const conditions: string[] = [
      'e.tenant_id = $1',
      "(e.context_type = 'course' AND e.context_id = $2)",
    ];

    if (q.from) { params.push(q.from); conditions.push(`e.start_at >= $${params.length}`); }
    if (q.to) { params.push(q.to); conditions.push(`e.start_at <= $${params.length}`); }

    const { rows } = await pool.query(
      `SELECT e.* FROM calendar_events e
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.start_at`,
      params
    );
    return reply.send({ data: rows });
  });

  // ── Cohort Calendar ────────────────────────────────────────────────────────

  fastify.get('/cohorts/:cohortId/calendar', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { cohortId } = request.params as { cohortId: string };
    const q = request.query as { from?: string; to?: string };
    const params: unknown[] = [request.tenantId, cohortId];
    const conditions: string[] = ['e.tenant_id = $1', 'e.context_type = \'cohort\'', 'e.context_id = $2'];

    if (q.from) { params.push(q.from); conditions.push(`e.start_at >= $${params.length}`); }
    if (q.to) { params.push(q.to); conditions.push(`e.start_at <= $${params.length}`); }

    const { rows } = await pool.query(
      `SELECT e.* FROM calendar_events e
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.start_at`,
      params
    );
    return reply.send({ data: rows });
  });

  // ── iCal Feeds ─────────────────────────────────────────────────────────────

  fastify.get('/ical', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) {
      return reply.status(401).send({ type: 'https://ako.invalid/errors/unauthorized', title: 'Unauthorized', status: 401 });
    }
    const parsed = verifyIcalToken(token, resolvedIcalSecret);
    if (!parsed) {
      return reply.status(401).send({ type: 'https://ako.invalid/errors/unauthorized', title: 'Unauthorized', status: 401 });
    }

    const now = new Date();
    const future = new Date(now);
    future.setFullYear(future.getFullYear() + 1);

    const { rows } = await pool.query(
      `SELECT * FROM calendar_events
       WHERE tenant_id = $1
         AND start_at BETWEEN $2 AND $3
         AND (visibility = 'public' OR created_by = $4)
       ORDER BY start_at`,
      [parsed.tenantId, now.toISOString(), future.toISOString(), parsed.userId]
    );

    const ical = eventsToIcal(rows, appBaseUrl);
    return reply.header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="ako-calendar.ics"')
      .send(ical);
  });

  fastify.get('/ical/token', { preHandler: fastify.authenticate }, async (request, reply) => {
    const token = generateIcalToken(request.user.sub, request.tenantId, resolvedIcalSecret);
    return reply.send({ token, url: `${appBaseUrl}/api/v1/calendar/ical?token=${token}` });
  });

  fastify.get('/courses/:courseId/ical', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const now = new Date();
    const future = new Date(now);
    future.setFullYear(future.getFullYear() + 1);

    const { rows } = await pool.query(
      `SELECT * FROM calendar_events
       WHERE tenant_id = $1 AND context_type = 'course' AND context_id = $2
         AND start_at BETWEEN $3 AND $4
       ORDER BY start_at`,
      [request.tenantId, courseId, now.toISOString(), future.toISOString()]
    );

    const ical = eventsToIcal(rows, appBaseUrl);
    return reply.header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="course-${courseId}.ics"`)
      .send(ical);
  });

  // ── External Sources (Admin) ───────────────────────────────────────────────

  fastify.get('/external-sources', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT s.*, u.display_name AS created_by_name
       FROM external_calendar_sources s
       LEFT JOIN users u ON u.user_id = s.created_by
       WHERE s.tenant_id = $1
       ORDER BY s.created_at DESC`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/external-sources', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = externalSourceSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;
    const { rows } = await pool.query(
      `INSERT INTO external_calendar_sources
         (tenant_id, name, url, sync_interval_minutes, active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [request.tenantId, d.name, d.url, d.sync_interval_minutes, d.active, request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.delete('/external-sources/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM external_calendar_sources WHERE source_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('External calendar source not found');
    return reply.status(204).send();
  });

  fastify.post('/external-sources/:id/sync', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `UPDATE external_calendar_sources SET last_synced_at = now(), updated_at = now()
       WHERE source_id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('External calendar source not found');
    // In a real implementation, this would enqueue a sync job
    return reply.send({ message: 'Sync triggered', source: rows[0] });
  });

  // ── External Events (read-only) ────────────────────────────────────────────

  fastify.get('/external-events', { preHandler: fastify.authenticate }, async (request, reply) => {
    const q = request.query as { from?: string; to?: string; source_id?: string };
    const params: unknown[] = [request.tenantId];
    const conditions: string[] = ['e.tenant_id = $1'];

    if (q.from) { params.push(q.from); conditions.push(`e.start_at >= $${params.length}`); }
    if (q.to) { params.push(q.to); conditions.push(`e.start_at <= $${params.length}`); }
    if (q.source_id) { params.push(q.source_id); conditions.push(`e.source_id = $${params.length}`); }

    const { rows } = await pool.query(
      `SELECT e.*, s.name AS source_name
       FROM external_calendar_events e
       JOIN external_calendar_sources s ON s.source_id = e.source_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.start_at`,
      params
    );
    return reply.send({ data: rows });
  });

  // ── Reminder Preferences ───────────────────────────────────────────────────

  fastify.get('/reminder-prefs', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM calendar_reminder_prefs
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY event_type`,
      [request.tenantId, request.user.sub]
    );
    return reply.send({ data: rows });
  });

  fastify.put('/reminder-prefs', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = z.object({ prefs: z.array(reminderPrefSchema) }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results: unknown[] = [];
      for (const pref of body.data.prefs) {
        const { rows } = await client.query(
          `INSERT INTO calendar_reminder_prefs (tenant_id, user_id, event_type, enabled, intervals)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (tenant_id, user_id, event_type) DO UPDATE SET
             enabled = EXCLUDED.enabled,
             intervals = EXCLUDED.intervals,
             updated_at = now()
           RETURNING *`,
          [request.tenantId, request.user.sub, pref.event_type, pref.enabled, pref.intervals]
        );
        results.push(rows[0]);
      }
      await client.query('COMMIT');
      return reply.send({ data: results });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
