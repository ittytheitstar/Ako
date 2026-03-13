import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const policySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  course_type: z.string().optional(),
  programme: z.string().optional(),
  regulatory_requirement: z.string().optional(),
  retention_months: z.number().int().min(1).default(84),
  access_level: z.enum(['read_only', 'restricted', 'none']).default('read_only'),
  disposal_action: z.enum(['archive', 'delete', 'export']).default('archive'),
});

export async function retentionRoutes(fastify: FastifyInstance) {
  // List retention policies
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { cursor, limit = 20 } = request.query as { cursor?: string; limit?: number };
    const params: unknown[] = [request.tenantId, Math.min(Number(limit), 100)];
    let query = `SELECT * FROM retention_policies WHERE tenant_id = $1`;
    if (cursor) { query += ` AND policy_id > $3`; params.push(cursor); }
    query += ` ORDER BY name LIMIT $2`;
    const { rows } = await pool.query(query, params);
    return reply.send({
      data: rows,
      nextCursor: rows.length === Number(limit) ? rows[rows.length - 1].policy_id : undefined,
    });
  });

  // Get a single retention policy
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM retention_policies WHERE policy_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Retention policy not found');
    return reply.send(rows[0]);
  });

  // Create retention policy
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = policySchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;
    const { rows } = await pool.query(
      `INSERT INTO retention_policies
         (tenant_id, name, description, course_type, programme, regulatory_requirement,
          retention_months, access_level, disposal_action, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [request.tenantId, d.name, d.description, d.course_type, d.programme,
       d.regulatory_requirement, d.retention_months, d.access_level, d.disposal_action,
       request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  // Update retention policy
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = policySchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const d = body.data;
    if (d.name !== undefined) { fields.push(`name = $${i++}`); values.push(d.name); }
    if (d.description !== undefined) { fields.push(`description = $${i++}`); values.push(d.description); }
    if (d.course_type !== undefined) { fields.push(`course_type = $${i++}`); values.push(d.course_type); }
    if (d.programme !== undefined) { fields.push(`programme = $${i++}`); values.push(d.programme); }
    if (d.regulatory_requirement !== undefined) { fields.push(`regulatory_requirement = $${i++}`); values.push(d.regulatory_requirement); }
    if (d.retention_months !== undefined) { fields.push(`retention_months = $${i++}`); values.push(d.retention_months); }
    if (d.access_level !== undefined) { fields.push(`access_level = $${i++}`); values.push(d.access_level); }
    if (d.disposal_action !== undefined) { fields.push(`disposal_action = $${i++}`); values.push(d.disposal_action); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE retention_policies SET ${fields.join(', ')}
       WHERE policy_id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Retention policy not found');
    return reply.send(rows[0]);
  });

  // Delete retention policy
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM retention_policies WHERE policy_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Retention policy not found');
    return reply.status(204).send();
  });
}
