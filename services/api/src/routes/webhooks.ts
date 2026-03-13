import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const webhookSchema = z.object({
  name: z.string().min(1).max(100),
  target_url: z.string().url(),
  event_types: z.array(z.string()).default([]),
  secret: z.string().optional(),
  active: z.boolean().default(true),
});

export async function webhookRoutes(fastify: FastifyInstance) {
  // List webhooks
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM webhooks WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [request.tenantId]
    );
    // Never return secret in list
    return reply.send({ data: rows.map(({ secret: _s, ...w }) => w) });
  });

  // Create webhook
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = webhookSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO webhooks (tenant_id, name, target_url, event_types, secret, active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        request.tenantId,
        body.data.name,
        body.data.target_url,
        body.data.event_types,
        body.data.secret,
        body.data.active,
        request.user.sub,
      ]
    );
    const { secret: _s, ...result } = rows[0];
    return reply.status(201).send(result);
  });

  // Get webhook
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM webhooks WHERE webhook_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Webhook not found');
    const { secret: _s, ...result } = rows[0];
    return reply.send(result);
  });

  // Update webhook
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = webhookSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(body.data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }
    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id, request.tenantId);

    const { rows } = await pool.query(
      `UPDATE webhooks SET ${fields.join(', ')}
       WHERE webhook_id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Webhook not found');
    const { secret: _s, ...result } = rows[0];
    return reply.send(result);
  });

  // Delete webhook
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM webhooks WHERE webhook_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Webhook not found');
    return reply.status(204).send();
  });

  // Test event (fire a test payload)
  fastify.post('/events/test', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { event_type, payload } = request.body as { event_type?: string; payload?: unknown };
    if (!event_type) throw BadRequest('event_type is required');

    // Find active webhooks subscribed to this event type
    const { rows: hooks } = await pool.query(
      `SELECT * FROM webhooks WHERE tenant_id = $1 AND active = true AND ($2 = ANY(event_types) OR '*' = ANY(event_types))`,
      [request.tenantId, event_type]
    );

    const results = await Promise.allSettled(
      hooks.map(async (hook) => {
        const testPayload = {
          webhook_id: hook.webhook_id,
          event_type,
          test: true,
          payload: payload ?? {},
          sent_at: new Date().toISOString(),
        };
        let httpStatus = 0;
        let responseBody = '';
        try {
          const res = await fetch(hook.target_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Ako-Event': event_type },
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(5000),
          });
          httpStatus = res.status;
          responseBody = await res.text().catch(() => '');
        } catch (err) {
          responseBody = String(err);
        }
        await pool.query(
          `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status, http_status, response_body)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            hook.webhook_id,
            event_type,
            JSON.stringify(testPayload),
            httpStatus >= 200 && httpStatus < 300 ? 'delivered' : 'failed',
            httpStatus,
            responseBody.slice(0, 1000),
          ]
        );
        return { webhook_id: hook.webhook_id, name: hook.name, http_status: httpStatus };
      })
    );

    return reply.send({
      event_type,
      webhooks_notified: hooks.length,
      results: results.map((r, i) =>
        r.status === 'fulfilled' ? r.value : { webhook_id: hooks[i].webhook_id, error: String((r as PromiseRejectedResult).reason) }
      ),
    });
  });

  // List deliveries for a webhook
  fastify.get('/:id/deliveries', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT wd.* FROM webhook_deliveries wd
       JOIN webhooks w ON w.webhook_id = wd.webhook_id
       WHERE wd.webhook_id = $1 AND w.tenant_id = $2
       ORDER BY wd.fired_at DESC LIMIT 100`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });
}
