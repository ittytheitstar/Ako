import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID, createHash } from 'crypto';
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

  // ── OIDC SSO ────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/auth/oidc/config
   * Returns whether OIDC SSO is configured so the frontend can show/hide the button.
   */
  fastify.get('/oidc/config', async (_request, reply) => {
    const enabled = Boolean(
      config.OIDC_ISSUER_URL && config.OIDC_CLIENT_ID && config.OIDC_CLIENT_SECRET
    );
    return reply.send({ enabled, clientId: enabled ? config.OIDC_CLIENT_ID : undefined });
  });

  /**
   * GET /api/v1/auth/oidc/authorize
   * Initiates the OIDC Authorization Code flow.
   * Generates a state + PKCE code_verifier, stores them in Redis, then redirects
   * the browser to the identity provider's authorization endpoint.
   */
  fastify.get('/oidc/authorize', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    if (!config.OIDC_ISSUER_URL || !config.OIDC_CLIENT_ID || !config.OIDC_REDIRECT_URI) {
      return reply.status(503).send({
        type: 'https://ako.invalid/errors/oidc-not-configured',
        title: 'OIDC Not Configured',
        status: 503,
        detail: 'OIDC SSO is not configured on this server.',
      });
    }

    // Discover the authorization endpoint from the issuer's well-known document
    let authorizationEndpoint: string;
    try {
      const wellKnownUrl = `${config.OIDC_ISSUER_URL.replace(/\/$/, '')}/.well-known/openid-configuration`;
      const discoveryRes = await fetch(wellKnownUrl);
      if (!discoveryRes.ok) throw new Error('Discovery failed');
      const discovery = (await discoveryRes.json()) as { authorization_endpoint: string };
      authorizationEndpoint = discovery.authorization_endpoint;
    } catch {
      return reply.status(502).send({
        type: 'https://ako.invalid/errors/oidc-discovery-failed',
        title: 'OIDC Discovery Failed',
        status: 502,
        detail: 'Unable to reach the OIDC provider.',
      });
    }

    // PKCE: generate code_verifier and code_challenge
    const codeVerifier = randomUUID() + randomUUID();
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const state = randomUUID();
    const nonce = randomUUID();

    // Persist state, nonce, and code_verifier in Redis (TTL 10 minutes)
    await fastify.redis.setex(
      `oidc:state:${state}`,
      600,
      JSON.stringify({ nonce, codeVerifier })
    );

    const { returnTo } = request.query as { returnTo?: string };
    if (returnTo) {
      await fastify.redis.setex(`oidc:return:${state}`, 600, returnTo);
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.OIDC_CLIENT_ID,
      redirect_uri: config.OIDC_REDIRECT_URI,
      scope: config.OIDC_SCOPES,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return reply.redirect(`${authorizationEndpoint}?${params.toString()}`);
  });

  /**
   * GET /api/v1/auth/oidc/callback
   * Handles the authorization code callback from the identity provider.
   * Exchanges the code for tokens, upserts the user, issues an Ako JWT, and
   * redirects back to the frontend with the access/refresh tokens.
   */
  fastify.get('/oidc/callback', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    if (!config.OIDC_ISSUER_URL || !config.OIDC_CLIENT_ID || !config.OIDC_CLIENT_SECRET || !config.OIDC_REDIRECT_URI) {
      return reply.status(503).send({ error: 'OIDC not configured' });
    }

    const { code, state, error: oidcError } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (oidcError) {
      return reply.redirect(`${config.APP_URL}/login?error=${encodeURIComponent(oidcError)}`);
    }

    if (!code || !state) throw BadRequest('Missing code or state');

    // Validate state
    const stored = await fastify.redis.get(`oidc:state:${state}`);
    if (!stored) throw Unauthorized('Invalid or expired OIDC state');
    const { codeVerifier } = JSON.parse(stored) as { nonce: string; codeVerifier: string };
    await fastify.redis.del(`oidc:state:${state}`);

    // Discover token endpoint
    let tokenEndpoint: string;
    let userInfoEndpoint: string;
    try {
      const wellKnownUrl = `${config.OIDC_ISSUER_URL.replace(/\/$/, '')}/.well-known/openid-configuration`;
      const discoveryRes = await fetch(wellKnownUrl);
      if (!discoveryRes.ok) throw new Error('Discovery failed');
      const discovery = (await discoveryRes.json()) as {
        token_endpoint: string;
        userinfo_endpoint: string;
      };
      tokenEndpoint = discovery.token_endpoint;
      userInfoEndpoint = discovery.userinfo_endpoint;
    } catch {
      return reply.redirect(`${config.APP_URL}/login?error=oidc_discovery_failed`);
    }

    // Exchange code for tokens
    let idTokenClaims: Record<string, unknown>;
    try {
      const tokenRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.OIDC_REDIRECT_URI,
          client_id: config.OIDC_CLIENT_ID,
          client_secret: config.OIDC_CLIENT_SECRET,
          code_verifier: codeVerifier,
        }),
      });

      if (!tokenRes.ok) throw new Error('Token exchange failed');
      const tokenData = (await tokenRes.json()) as { access_token: string };

      // Fetch user info
      const userInfoRes = await fetch(userInfoEndpoint, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userInfoRes.ok) throw new Error('UserInfo request failed');
      idTokenClaims = (await userInfoRes.json()) as Record<string, unknown>;
    } catch {
      return reply.redirect(`${config.APP_URL}/login?error=oidc_token_exchange_failed`);
    }

    const sub = String(idTokenClaims['sub'] ?? '');
    const email = String(idTokenClaims['email'] ?? '');
    const displayName =
      String(idTokenClaims['name'] ?? idTokenClaims['preferred_username'] ?? email);
    const givenName = idTokenClaims['given_name'] ? String(idTokenClaims['given_name']) : undefined;
    const familyName = idTokenClaims['family_name'] ? String(idTokenClaims['family_name']) : undefined;

    if (!sub || !email) {
      return reply.redirect(`${config.APP_URL}/login?error=oidc_missing_claims`);
    }

    // Resolve tenant (use first tenant or create default)
    const { rows: tenantRows } = await pool.query(
      `SELECT tenant_id FROM tenants ORDER BY created_at LIMIT 1`
    );
    let tenantId: string;
    if (tenantRows.length > 0) {
      tenantId = tenantRows[0].tenant_id;
    } else {
      const { rows: newTenant } = await pool.query(
        `INSERT INTO tenants (name, slug) VALUES ('Default', 'default') RETURNING tenant_id`
      );
      tenantId = newTenant[0].tenant_id;
    }

    // Upsert user via OIDC identity
    let userId: string;
    const { rows: identityRows } = await pool.query(
      `SELECT ui.user_id FROM user_identities ui
       JOIN users u ON u.user_id = ui.user_id
       WHERE ui.tenant_id = $1 AND ui.provider = 'oidc' AND ui.subject = $2`,
      [tenantId, sub]
    );

    if (identityRows.length > 0) {
      userId = identityRows[0].user_id;
      // Update user profile from latest claims
      await pool.query(
        `UPDATE users SET display_name = $1, given_name = $2, family_name = $3, updated_at = now()
         WHERE user_id = $4`,
        [displayName, givenName ?? null, familyName ?? null, userId]
      );
    } else {
      // Create new user
      const username = email.split('@')[0] + '_' + randomUUID().slice(0, 8);
      const { rows: userRows } = await pool.query(
        `INSERT INTO users (tenant_id, username, email, display_name, given_name, family_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, email)
         DO UPDATE SET display_name = EXCLUDED.display_name,
                       given_name   = EXCLUDED.given_name,
                       family_name  = EXCLUDED.family_name,
                       updated_at   = now()
         RETURNING user_id`,
        [tenantId, username, email, displayName, givenName ?? null, familyName ?? null]
      );
      userId = userRows[0].user_id;

      await pool.query(
        `INSERT INTO user_identities (tenant_id, user_id, provider, subject, claims)
         VALUES ($1, $2, 'oidc', $3, $4)
         ON CONFLICT (tenant_id, provider, subject) DO NOTHING`,
        [tenantId, userId, sub, JSON.stringify(idTokenClaims)]
      );
    }

    // Fetch roles and permissions
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

    const tokenPayload: TokenPayload = { sub: userId, tenantId, roles, permissions };
    const accessToken = fastify.jwt.sign(tokenPayload, { expiresIn: config.JWT_EXPIRY });
    const refreshToken = randomUUID();

    await fastify.redis.setex(
      `refresh:${refreshToken}`,
      config.REFRESH_TOKEN_EXPIRY_SECONDS,
      JSON.stringify({ userId, tenantId })
    );

    // Redirect to frontend callback page with tokens
    const returnTo = await fastify.redis.get(`oidc:return:${state}`);
    await fastify.redis.del(`oidc:return:${state}`);
    const frontendUrl = returnTo ?? `${config.APP_URL}/login/callback`;

    const redirectUrl = new URL(frontendUrl, config.APP_URL);
    redirectUrl.searchParams.set('accessToken', accessToken);
    redirectUrl.searchParams.set('refreshToken', refreshToken);

    return reply.redirect(redirectUrl.toString());
  });
}
