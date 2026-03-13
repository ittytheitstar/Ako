import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const pluginSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  plugin_type: z.enum(['ui', 'backend', 'automation']).default('ui'),
  api_version: z.string().default('1'),
  permission_scopes: z.array(z.string()).default([]),
  author: z.string().optional(),
  homepage_url: z.string().url().optional(),
  enabled_contexts: z.array(z.unknown()).default([]),
  resource_limits: z.record(z.unknown()).default({}),
});

export async function pluginRoutes(fastify: FastifyInstance) {
  // List plugins
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT p.*, pv.version as current_version
       FROM plugins p
       LEFT JOIN plugin_versions pv ON pv.plugin_id = p.plugin_id AND pv.is_current = true
       WHERE p.tenant_id = $1
       ORDER BY p.installed_at DESC`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Install / register a plugin
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = pluginSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO plugins
         (tenant_id, name, description, plugin_type, api_version, permission_scopes,
          author, homepage_url, enabled_contexts, resource_limits, installed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        request.tenantId,
        body.data.name,
        body.data.description,
        body.data.plugin_type,
        body.data.api_version,
        body.data.permission_scopes,
        body.data.author,
        body.data.homepage_url,
        JSON.stringify(body.data.enabled_contexts),
        JSON.stringify(body.data.resource_limits),
        request.user.sub,
      ]
    );
    return reply.status(201).send(rows[0]);
  });

  // Get a plugin
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT p.*, pv.version as current_version
       FROM plugins p
       LEFT JOIN plugin_versions pv ON pv.plugin_id = p.plugin_id AND pv.is_current = true
       WHERE p.plugin_id = $1 AND p.tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Plugin not found');
    return reply.send(rows[0]);
  });

  // Enable a plugin
  fastify.post('/:id/enable', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `UPDATE plugins SET status = 'enabled', updated_at = now()
       WHERE plugin_id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Plugin not found');
    return reply.send(rows[0]);
  });

  // Disable a plugin
  fastify.post('/:id/disable', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `UPDATE plugins SET status = 'disabled', updated_at = now()
       WHERE plugin_id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Plugin not found');
    return reply.send(rows[0]);
  });

  // Delete (uninstall) a plugin
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM plugins WHERE plugin_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Plugin not found');
    return reply.status(204).send();
  });

  // List versions for a plugin
  fastify.get('/:id/versions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT pv.* FROM plugin_versions pv
       JOIN plugins p ON p.plugin_id = pv.plugin_id
       WHERE pv.plugin_id = $1 AND p.tenant_id = $2
       ORDER BY pv.published_at DESC`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Publish a new version
  fastify.post('/:id/versions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as { version: string; changelog?: string; bundle_url?: string; bundle_hash?: string });
    if (!body.version) throw BadRequest('version is required');

    await pool.query(
      `UPDATE plugin_versions SET is_current = false WHERE plugin_id = $1`,
      [id]
    );
    const { rows } = await pool.query(
      `INSERT INTO plugin_versions (plugin_id, version, changelog, bundle_url, bundle_hash, is_current)
       VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
      [id, body.version, body.changelog, body.bundle_url, body.bundle_hash]
    );
    return reply.status(201).send(rows[0]);
  });
}
