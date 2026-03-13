import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const termSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export async function termRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM terms WHERE tenant_id = $1 ORDER BY start_date DESC NULLS LAST, created_at DESC`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM terms WHERE term_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Term not found');
    return reply.send(rows[0]);
  });

  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = termSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO terms (tenant_id, name, code, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request.tenantId, body.data.name, body.data.code, body.data.start_date ?? null, body.data.end_date ?? null]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = termSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const d = body.data;
    if (d.name !== undefined) { fields.push(`name = $${i++}`); values.push(d.name); }
    if (d.code !== undefined) { fields.push(`code = $${i++}`); values.push(d.code); }
    if (d.start_date !== undefined) { fields.push(`start_date = $${i++}`); values.push(d.start_date); }
    if (d.end_date !== undefined) { fields.push(`end_date = $${i++}`); values.push(d.end_date); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    values.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE terms SET ${fields.join(', ')} WHERE term_id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Term not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM terms WHERE term_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Term not found');
    return reply.status(204).send();
  });
}
