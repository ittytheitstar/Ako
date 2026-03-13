import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  settings: z.record(z.unknown()).optional(),
});

const updateSchema = createSchema.partial();

export async function tenantRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { cursor, limit = 20 } = request.query as { cursor?: string; limit?: number };
    const params: unknown[] = [Math.min(Number(limit), 100)];
    let query = `SELECT * FROM tenants`;
    if (cursor) {
      query += ` WHERE tenant_id > $2`;
      params.push(cursor);
    }
    query += ` ORDER BY tenant_id LIMIT $1`;
    const { rows } = await pool.query(query, params);
    return reply.send({
      data: rows,
      nextCursor: rows.length === Number(limit) ? rows[rows.length - 1].tenant_id : undefined,
    });
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(`SELECT * FROM tenants WHERE tenant_id = $1`, [id]);
    if (rows.length === 0) throw NotFound('Tenant not found');
    return reply.send(rows[0]);
  });

  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { name, slug, settings = {} } = body.data;
    const { rows } = await pool.query(
      `INSERT INTO tenants (name, slug, settings) VALUES ($1, $2, $3) RETURNING *`,
      [name, slug, JSON.stringify(settings)]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.data.name !== undefined) { fields.push(`name = $${i++}`); values.push(body.data.name); }
    if (body.data.slug !== undefined) { fields.push(`slug = $${i++}`); values.push(body.data.slug); }
    if (body.data.settings !== undefined) { fields.push(`settings = $${i++}`); values.push(JSON.stringify(body.data.settings)); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE tenants SET ${fields.join(', ')} WHERE tenant_id = $${i} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Tenant not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(`DELETE FROM tenants WHERE tenant_id = $1`, [id]);
    if (rowCount === 0) throw NotFound('Tenant not found');
    return reply.status(204).send();
  });
}
