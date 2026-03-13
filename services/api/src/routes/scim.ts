import { FastifyInstance } from 'fastify';
import { pool } from '../db/client';

const SCIM_SCHEMA_USER = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_SCHEMA_GROUP = 'urn:ietf:params:scim:schemas:core:2.0:Group';
const SCIM_LIST_RESPONSE = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';

function userToScim(user: Record<string, unknown>, baseUrl: string) {
  return {
    schemas: [SCIM_SCHEMA_USER],
    id: user.user_id,
    externalId: user.user_id,
    userName: user.username,
    name: {
      givenName: user.given_name,
      familyName: user.family_name,
      formatted: user.display_name,
    },
    emails: [{ value: user.email, primary: true }],
    active: user.active,
    meta: {
      resourceType: 'User',
      created: user.created_at,
      lastModified: user.updated_at,
      location: `${baseUrl}/Users/${user.user_id}`,
    },
  };
}

export async function scimRoutes(fastify: FastifyInstance) {
  fastify.get('/ServiceProviderConfig', async (_request, reply) => {
    return reply.send({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 100 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
    });
  });

  // List Users
  fastify.get('/Users', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { startIndex = 1, count = 100, filter } = request.query as {
      startIndex?: number;
      count?: number;
      filter?: string;
    };
    const tenantId = request.tenantId;
    let query = `SELECT * FROM users WHERE tenant_id = $1 AND deleted_at IS NULL`;
    const params: unknown[] = [tenantId];

    // Simple filter support: userName eq "value"
    if (filter) {
      const match = filter.match(/userName eq "([^"]+)"/);
      if (match) {
        params.push(match[1]);
        query += ` AND username = $${params.length}`;
      }
    }

    const offset = Number(startIndex) - 1;
    params.push(Number(count));
    params.push(offset);
    query += ` ORDER BY user_id LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [tenantId]
    );
    const total = parseInt(countResult.rows[0].count as string, 10);
    const baseUrl = `${request.protocol}://${request.hostname}/scim/v2`;

    return reply.send({
      schemas: [SCIM_LIST_RESPONSE],
      totalResults: total,
      startIndex: Number(startIndex),
      itemsPerPage: rows.length,
      Resources: rows.map((u) => userToScim(u, baseUrl)),
    });
  });

  // Get User
  fastify.get('/Users/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM users WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, request.tenantId]
    );
    if (rows.length === 0) {
      return reply.status(404).send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'User not found',
      });
    }
    const baseUrl = `${request.protocol}://${request.hostname}/scim/v2`;
    return reply.send(userToScim(rows[0], baseUrl));
  });

  // Create User
  fastify.post('/Users', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const userName = (body.userName as string) ?? '';
    const emails = (body.emails as Array<{ value: string; primary?: boolean }>) ?? [];
    const email = emails.find((e) => e.primary)?.value ?? emails[0]?.value ?? '';
    const name = (body.name as { givenName?: string; familyName?: string; formatted?: string }) ?? {};

    const { rows } = await pool.query(
      `INSERT INTO users (tenant_id, username, email, display_name, given_name, family_name, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [request.tenantId, userName, email, name.formatted ?? userName, name.givenName, name.familyName, body.active !== false]
    );

    const baseUrl = `${request.protocol}://${request.hostname}/scim/v2`;
    return reply.status(201).send(userToScim(rows[0], baseUrl));
  });

  // Replace User (PUT)
  fastify.put('/Users/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const emails = (body.emails as Array<{ value: string; primary?: boolean }>) ?? [];
    const email = emails.find((e) => e.primary)?.value ?? emails[0]?.value ?? '';
    const name = (body.name as { givenName?: string; familyName?: string; formatted?: string }) ?? {};

    const { rows } = await pool.query(
      `UPDATE users SET email = $1, display_name = $2, given_name = $3, family_name = $4, active = $5, updated_at = now()
       WHERE user_id = $6 AND tenant_id = $7 RETURNING *`,
      [email, name.formatted ?? '', name.givenName, name.familyName, body.active !== false, id, request.tenantId]
    );
    if (rows.length === 0) {
      return reply.status(404).send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'User not found',
      });
    }
    const baseUrl = `${request.protocol}://${request.hostname}/scim/v2`;
    return reply.send(userToScim(rows[0], baseUrl));
  });

  // Patch User
  fastify.patch('/Users/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      Operations?: Array<{ op: string; path?: string; value?: unknown }>;
    };

    for (const op of body.Operations ?? []) {
      if (op.op === 'replace' && op.path === 'active') {
        await pool.query(
          `UPDATE users SET active = $1, updated_at = now() WHERE user_id = $2 AND tenant_id = $3`,
          [op.value, id, request.tenantId]
        );
      }
    }

    const { rows } = await pool.query(
      `SELECT * FROM users WHERE user_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) {
      return reply.status(404).send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'User not found',
      });
    }
    const baseUrl = `${request.protocol}://${request.hostname}/scim/v2`;
    return reply.send(userToScim(rows[0], baseUrl));
  });

  // Delete User
  fastify.delete('/Users/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(
      `UPDATE users SET deleted_at = now() WHERE user_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    return reply.status(204).send();
  });

  // Groups — mapped to cohorts
  fastify.get('/Groups', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT c.*, array_agg(cm.user_id) FILTER (WHERE cm.user_id IS NOT NULL) as member_ids
       FROM cohorts c
       LEFT JOIN cohort_members cm ON cm.cohort_id = c.cohort_id
       WHERE c.tenant_id = $1
       GROUP BY c.cohort_id`,
      [request.tenantId]
    );
    const baseUrl = `${request.protocol}://${request.hostname}/scim/v2`;
    return reply.send({
      schemas: [SCIM_LIST_RESPONSE],
      totalResults: rows.length,
      startIndex: 1,
      itemsPerPage: rows.length,
      Resources: rows.map((g) => ({
        schemas: [SCIM_SCHEMA_GROUP],
        id: g.cohort_id,
        displayName: g.name,
        members: ((g.member_ids as string[]) ?? []).map((uid) => ({ value: uid })),
        meta: {
          resourceType: 'Group',
          created: g.created_at,
          location: `${baseUrl}/Groups/${g.cohort_id}`,
        },
      })),
    });
  });
}
