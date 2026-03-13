import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const createSchema = z.object({
  tenant_id: z.string().uuid(),
  username: z.string().min(3),
  email: z.string().email(),
  display_name: z.string().min(1),
  password: z.string().min(8),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  active: z.boolean().default(true),
});

const updateSchema = z.object({
  display_name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  active: z.boolean().optional(),
  email: z.string().email().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { cursor, limit = 20 } = request.query as { cursor?: string; limit?: number };
    const tenantId = request.tenantId;
    const params: unknown[] = [tenantId, Math.min(Number(limit), 100)];
    let query = `SELECT user_id, tenant_id, username, email, display_name, given_name, family_name, locale, timezone, active, created_at, updated_at
                 FROM users WHERE tenant_id = $1 AND deleted_at IS NULL`;
    if (cursor) {
      query += ` AND user_id > $3`;
      params.push(cursor);
    }
    query += ` ORDER BY user_id LIMIT $2`;
    const { rows } = await pool.query(query, params);
    return reply.send({
      data: rows,
      nextCursor: rows.length === Number(limit) ? rows[rows.length - 1].user_id : undefined,
    });
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT user_id, tenant_id, username, email, display_name, given_name, family_name, locale, timezone, active, created_at, updated_at
       FROM users WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('User not found');
    return reply.send(rows[0]);
  });

  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { password, ...userData } = body.data;
    const passwordHash = await bcrypt.hash(password, 12);
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');
      const { rows } = await dbClient.query(
        `INSERT INTO users (tenant_id, username, email, display_name, given_name, family_name, locale, timezone, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING user_id, tenant_id, username, email, display_name, given_name, family_name, locale, timezone, active, created_at, updated_at`,
        [userData.tenant_id, userData.username, userData.email, userData.display_name, userData.given_name, userData.family_name, userData.locale, userData.timezone, userData.active]
      );
      await dbClient.query(
        `INSERT INTO user_identities (tenant_id, user_id, provider, subject, claims) VALUES ($1, $2, 'local', $3, $4)`,
        [userData.tenant_id, rows[0].user_id, userData.username, JSON.stringify({ password_hash: passwordHash })]
      );
      await dbClient.query('COMMIT');
      return reply.status(201).send(rows[0]);
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally {
      dbClient.release();
    }
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const data = body.data;
    if (data.display_name !== undefined) { fields.push(`display_name = $${i++}`); values.push(data.display_name); }
    if (data.given_name !== undefined) { fields.push(`given_name = $${i++}`); values.push(data.given_name); }
    if (data.family_name !== undefined) { fields.push(`family_name = $${i++}`); values.push(data.family_name); }
    if (data.locale !== undefined) { fields.push(`locale = $${i++}`); values.push(data.locale); }
    if (data.timezone !== undefined) { fields.push(`timezone = $${i++}`); values.push(data.timezone); }
    if (data.active !== undefined) { fields.push(`active = $${i++}`); values.push(data.active); }
    if (data.email !== undefined) { fields.push(`email = $${i++}`); values.push(data.email); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id, request.tenantId);
    const { rows } = await pool.query(
      `UPDATE users SET ${fields.join(', ')}
       WHERE user_id = $${i} AND tenant_id = $${i + 1} AND deleted_at IS NULL
       RETURNING user_id, tenant_id, username, email, display_name, given_name, family_name, locale, timezone, active, created_at, updated_at`,
      values
    );
    if (rows.length === 0) throw NotFound('User not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `UPDATE users SET deleted_at = now() WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('User not found');
    return reply.status(204).send();
  });
}
