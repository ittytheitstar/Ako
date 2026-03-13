import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const alertSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  metric_name: z.string().min(1),
  threshold_value: z.number(),
  comparison: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']).default('gt'),
  window_seconds: z.number().int().min(60).max(86400).default(300),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  active: z.boolean().default(true),
  notify_channels: z.array(z.string()).default(['platform']),
});

export async function systemAlertRoutes(fastify: FastifyInstance) {
  // GET /system-alerts/triggered  — recent triggered alert events (registered before /:id to avoid route conflict)
  fastify.get('/triggered', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { limit = '50' } = request.query as { limit?: string };
    const { rows } = await pool.query(
      `SELECT sae.*, sa.name AS alert_name, sa.metric_name, sa.severity AS rule_severity
       FROM system_alert_events sae
       JOIN system_alerts sa ON sa.alert_id = sae.alert_id
       WHERE sae.tenant_id = $1 OR sae.tenant_id IS NULL
       ORDER BY sae.triggered_at DESC LIMIT $2`,
      [request.tenantId, parseInt(limit, 10)]
    );
    return reply.send({ data: rows });
  });

  // List alert rules
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM system_alerts
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY severity DESC, name`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Create alert rule
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = alertSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows } = await pool.query(
      `INSERT INTO system_alerts
         (tenant_id, name, description, metric_name, threshold_value, comparison,
          window_seconds, severity, active, notify_channels, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        request.tenantId,
        body.data.name,
        body.data.description ?? null,
        body.data.metric_name,
        body.data.threshold_value,
        body.data.comparison,
        body.data.window_seconds,
        body.data.severity,
        body.data.active,
        body.data.notify_channels,
        request.user.sub,
      ]
    );
    return reply.status(201).send(rows[0]);
  });

  // Get single alert rule
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM system_alerts
       WHERE alert_id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('System alert not found');
    return reply.send(rows[0]);
  });

  // Update alert rule
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = alertSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(body.data.name); }
    if (body.data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(body.data.description); }
    if (body.data.metric_name !== undefined) { fields.push(`metric_name = $${idx++}`); values.push(body.data.metric_name); }
    if (body.data.threshold_value !== undefined) { fields.push(`threshold_value = $${idx++}`); values.push(body.data.threshold_value); }
    if (body.data.comparison !== undefined) { fields.push(`comparison = $${idx++}`); values.push(body.data.comparison); }
    if (body.data.window_seconds !== undefined) { fields.push(`window_seconds = $${idx++}`); values.push(body.data.window_seconds); }
    if (body.data.severity !== undefined) { fields.push(`severity = $${idx++}`); values.push(body.data.severity); }
    if (body.data.active !== undefined) { fields.push(`active = $${idx++}`); values.push(body.data.active); }
    if (body.data.notify_channels !== undefined) { fields.push(`notify_channels = $${idx++}`); values.push(body.data.notify_channels); }

    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push('updated_at = now()');
    values.push(id, request.tenantId);

    const { rows } = await pool.query(
      `UPDATE system_alerts SET ${fields.join(', ')}
       WHERE alert_id = $${idx++} AND (tenant_id = $${idx} OR tenant_id IS NULL)
       RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('System alert not found');
    return reply.send(rows[0]);
  });

  // Delete alert rule
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM system_alerts WHERE alert_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('System alert not found');
    return reply.status(204).send();
  });
}
