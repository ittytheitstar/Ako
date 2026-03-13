import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const connectorSchema = z.object({
  name: z.string().min(1).max(100),
  connector_type: z.enum(['sis', 'sms', 'identity', 'assessment', 'content', 'analytics']),
  settings: z.record(z.unknown()).default({}),
});

export async function integrationRoutes(fastify: FastifyInstance) {
  // List integrations
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM integration_connectors WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Create integration
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = connectorSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO integration_connectors (tenant_id, name, connector_type, settings, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [request.tenantId, body.data.name, body.data.connector_type, JSON.stringify(body.data.settings), request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  // Get integration
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM integration_connectors WHERE connector_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Integration connector not found');
    return reply.send(rows[0]);
  });

  // Update integration settings
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = connectorSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (body.data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(body.data.name); }
    if (body.data.connector_type !== undefined) { fields.push(`connector_type = $${idx++}`); values.push(body.data.connector_type); }
    if (body.data.settings !== undefined) { fields.push(`settings = $${idx++}`); values.push(JSON.stringify(body.data.settings)); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push('updated_at = now()');
    values.push(id, request.tenantId);

    const { rows } = await pool.query(
      `UPDATE integration_connectors SET ${fields.join(', ')}
       WHERE connector_id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Integration connector not found');
    return reply.send(rows[0]);
  });

  // Delete integration
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM integration_connectors WHERE connector_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Integration connector not found');
    return reply.status(204).send();
  });

  // Health check for an integration
  fastify.get('/:id/health', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM integration_connectors WHERE connector_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Integration connector not found');

    const connector = rows[0] as {
      connector_id: string;
      name: string;
      connector_type: string;
      settings: Record<string, unknown>;
      status: string;
      health_status: string;
      last_health_check: string | null;
      latency_ms: number | null;
      error_message: string | null;
    };

    // Perform health probe if a health_url is configured
    let healthStatus: string = connector.health_status ?? 'unknown';
    let latencyMs: number | null = null;
    let errorMessage: string | null = null;

    const healthUrl = (connector.settings as Record<string, unknown>).health_url as string | undefined;
    if (healthUrl) {
      const start = Date.now();
      try {
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
        latencyMs = Date.now() - start;
        healthStatus = res.ok ? 'healthy' : 'degraded';
      } catch (err) {
        latencyMs = Date.now() - start;
        healthStatus = 'unhealthy';
        errorMessage = String(err);
      }

      await pool.query(
        `UPDATE integration_connectors
         SET health_status = $1, last_health_check = now(), latency_ms = $2, error_message = $3,
             status = CASE WHEN $1 = 'healthy' THEN 'connected' ELSE 'error' END,
             updated_at = now()
         WHERE connector_id = $4`,
        [healthStatus, latencyMs, errorMessage, id]
      );
    }

    return reply.send({
      connector_id: connector.connector_id,
      name: connector.name,
      health_status: healthStatus,
      latency_ms: latencyMs,
      last_health_check: new Date().toISOString(),
      error_message: errorMessage,
    });
  });
}
