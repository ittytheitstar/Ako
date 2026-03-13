import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { pool } from '../db/client';
import { config } from '../config';
import { BadRequest, Unauthorized, NotFound, Conflict } from '@ako/shared';
import { TokenPayload } from '@ako/shared';

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1),
  tenant_id: z.string().uuid().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/token', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { username, password } = body.data;

    const { rows } = await pool.query(
      `SELECT u.user_id, u.tenant_id, u.username, u.email, u.display_name, u.active,
              ui.claims->>'password_hash' as password_hash
       FROM users u
       JOIN user_identities ui ON ui.user_id = u.user_id AND ui.provider = 'local'
       WHERE u.username = $1 OR u.email = $1
       LIMIT 1`,
      [username]
    );

    if (rows.length === 0) throw Unauthorized('Invalid credentials');
    const user = rows[0];
    if (!user.active) throw Unauthorized('Account disabled');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw Unauthorized('Invalid credentials');

    const { rows: roleRows } = await pool.query(
      `SELECT r.name as role_name, p.name as permission_name
       FROM user_roles ur
       JOIN roles r ON r.role_id = ur.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
       LEFT JOIN permissions p ON p.permission_id = rp.permission_id
       WHERE ur.user_id = $1 AND ur.tenant_id = $2`,
      [user.user_id, user.tenant_id]
    );

    const roles = [...new Set(roleRows.map((r: { role_name: string }) => r.role_name))];
    const permissions = [
      ...new Set(
        roleRows
          .filter((r: { permission_name: string | null }) => r.permission_name)
          .map((r: { permission_name: string }) => r.permission_name)
      ),
    ];

    const payload: TokenPayload = {
      sub: user.user_id,
      tenantId: user.tenant_id,
      roles,
      permissions,
    };

    const accessToken = fastify.jwt.sign(payload, { expiresIn: config.JWT_EXPIRY });
    const refreshToken = randomUUID();

    await fastify.redis.setex(
      `refresh:${refreshToken}`,
      config.REFRESH_TOKEN_EXPIRY_SECONDS,
      JSON.stringify({ userId: user.user_id, tenantId: user.tenant_id })
    );

    return reply.send({ accessToken, refreshToken });
  });

  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { username, email, password, display_name, tenant_id } = body.data;

    let resolvedTenantId = tenant_id;
    if (!resolvedTenantId) {
      const { rows } = await pool.query(`SELECT tenant_id FROM tenants ORDER BY created_at LIMIT 1`);
      if (rows.length > 0) {
        resolvedTenantId = rows[0].tenant_id;
      } else {
        const { rows: newTenant } = await pool.query(
          `INSERT INTO tenants (name, slug) VALUES ('Default', 'default') RETURNING tenant_id`
        );
        resolvedTenantId = newTenant[0].tenant_id;
      }
    }

    const { rows: existing } = await pool.query(
      `SELECT user_id FROM users WHERE tenant_id = $1 AND (username = $2 OR email = $3)`,
      [resolvedTenantId, username, email]
    );
    if (existing.length > 0) throw Conflict('Username or email already exists');

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (tenant_id, username, email, display_name) VALUES ($1, $2, $3, $4) RETURNING *`,
      [resolvedTenantId, username, email, display_name]
    );
    const user = rows[0];

    await pool.query(
      `INSERT INTO user_identities (tenant_id, user_id, provider, subject, claims)
       VALUES ($1, $2, 'local', $3, $4)`,
      [resolvedTenantId, user.user_id, username, JSON.stringify({ password_hash: passwordHash })]
    );

    return reply.status(201).send({
      user_id: user.user_id,
      tenant_id: user.tenant_id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      active: user.active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  });

  fastify.get('/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const payload = request.user as TokenPayload;
    const { rows } = await pool.query(
      `SELECT user_id, tenant_id, username, email, display_name, given_name, family_name,
              locale, timezone, active, created_at, updated_at
       FROM users WHERE user_id = $1`,
      [payload.sub]
    );
    if (rows.length === 0) throw NotFound('User not found');
    return reply.send(rows[0]);
  });

  fastify.post('/refresh', async (request, reply) => {
    const body = refreshSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const stored = await fastify.redis.get(`refresh:${body.data.refreshToken}`);
    if (!stored) throw Unauthorized('Invalid or expired refresh token');

    const { userId, tenantId } = JSON.parse(stored) as { userId: string; tenantId: string };

    const { rows: roleRows } = await pool.query(
      `SELECT r.name as role_name, p.name as permission_name
       FROM user_roles ur
       JOIN roles r ON r.role_id = ur.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
       LEFT JOIN permissions p ON p.permission_id = rp.permission_id
       WHERE ur.user_id = $1 AND ur.tenant_id = $2`,
      [userId, tenantId]
    );

    const roles = [...new Set(roleRows.map((r: { role_name: string }) => r.role_name))];
    const permissions = [
      ...new Set(
        roleRows
          .filter((r: { permission_name: string | null }) => r.permission_name)
          .map((r: { permission_name: string }) => r.permission_name)
      ),
    ];

    const payload: TokenPayload = { sub: userId, tenantId, roles, permissions };
    const accessToken = fastify.jwt.sign(payload, { expiresIn: config.JWT_EXPIRY });
    const newRefreshToken = randomUUID();

    await fastify.redis.del(`refresh:${body.data.refreshToken}`);
    await fastify.redis.setex(
      `refresh:${newRefreshToken}`,
      config.REFRESH_TOKEN_EXPIRY_SECONDS,
      JSON.stringify({ userId, tenantId })
    );

    return reply.send({ accessToken, refreshToken: newRefreshToken });
  });
}
