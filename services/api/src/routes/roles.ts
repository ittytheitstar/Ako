import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  system_role: z.boolean().default(false),
});

export async function roleRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM roles WHERE tenant_id = $1 ORDER BY created_at`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM roles WHERE role_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Role not found');
    return reply.send(rows[0]);
  });

  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO roles (tenant_id, name, description, system_role) VALUES ($1, $2, $3, $4) RETURNING *`,
      [request.tenantId, body.data.name, body.data.description, body.data.system_role]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.data.name !== undefined) { fields.push(`name = $${i++}`); values.push(body.data.name); }
    if (body.data.description !== undefined) { fields.push(`description = $${i++}`); values.push(body.data.description); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    values.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE roles SET ${fields.join(', ')} WHERE role_id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Role not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM roles WHERE role_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Role not found');
    return reply.status(204).send();
  });

  fastify.get('/:id/permissions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.permission_id
       WHERE rp.role_id = $1`,
      [id]
    );
    return reply.send(rows);
  });

  fastify.post('/:id/permissions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ permission_id: z.string().uuid() }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, body.data.permission_id]
    );
    return reply.status(201).send({ role_id: id, permission_id: body.data.permission_id });
  });

  fastify.delete('/:id/permissions/:permId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id, permId } = request.params as { id: string; permId: string };
    await pool.query(
      `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
      [id, permId]
    );
    return reply.status(204).send();
  });
}
