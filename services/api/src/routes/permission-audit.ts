import { FastifyInstance } from 'fastify';
import { pool } from '../db/client';

/** Roles with more than this multiple of the average permission count are flagged as overly broad */
const BROAD_ROLE_THRESHOLD_MULTIPLIER = 1.5;
/** Denials per permission in 24h above this count are flagged as a spike */
const DENIAL_SPIKE_THRESHOLD = 10;

export async function permissionAuditRoutes(fastify: FastifyInstance) {
  // GET /permission-audit/matrix  — role × permission matrix for the tenant
  fastify.get('/matrix', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows: roles } = await pool.query(
      `SELECT r.role_id, r.name AS role_name, array_agg(p.name ORDER BY p.name) AS permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
       LEFT JOIN permissions p ON p.permission_id = rp.permission_id
       WHERE r.tenant_id = $1
       GROUP BY r.role_id, r.name
       ORDER BY r.name`,
      [request.tenantId]
    );

    const { rows: allPerms } = await pool.query(
      `SELECT permission_id, name, description FROM permissions ORDER BY name`
    );

    return reply.send({
      roles,
      permissions: allPerms,
    });
  });

  // GET /permission-audit/events  — filtered log of permission checks
  fastify.get('/events', { preHandler: fastify.authenticate }, async (request, reply) => {
    const {
      cursor,
      limit = '50',
      permission_name,
      actor_id,
      granted,
    } = request.query as {
      cursor?: string;
      limit?: string;
      permission_name?: string;
      actor_id?: string;
      granted?: string;
    };

    const conditions: string[] = ['tenant_id = $1'];
    const values: unknown[] = [request.tenantId];
    let idx = 2;

    if (permission_name) { conditions.push(`permission_name = $${idx++}`); values.push(permission_name); }
    if (actor_id) { conditions.push(`actor_id = $${idx++}`); values.push(actor_id); }
    if (granted !== undefined) { conditions.push(`granted = $${idx++}`); values.push(granted === 'true'); }
    if (cursor) { conditions.push(`checked_at < $${idx++}`); values.push(cursor); }

    values.push(parseInt(limit, 10));
    const { rows } = await pool.query(
      `SELECT * FROM permission_audit_logs
       WHERE ${conditions.join(' AND ')}
       ORDER BY checked_at DESC LIMIT $${idx}`,
      values
    );

    const nextCursor = rows.length === parseInt(limit, 10) ? rows[rows.length - 1]?.checked_at : null;
    return reply.send({ data: rows, next_cursor: nextCursor });
  });

  // GET /permission-audit/anomalies  — roles/users with unusually broad access
  fastify.get('/anomalies', { preHandler: fastify.authenticate }, async (request, reply) => {
    // Roles with more than the average number of permissions
    const { rows: broadRoles } = await pool.query(
      `WITH role_counts AS (
         SELECT r.role_id, r.name AS role_name, count(rp.permission_id) AS perm_count
         FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
         WHERE r.tenant_id = $1
         GROUP BY r.role_id, r.name
       ),
       avg_count AS (SELECT avg(perm_count) AS avg FROM role_counts)
       SELECT rc.*, ac.avg,
              CASE WHEN rc.perm_count > ac.avg * $2 THEN 'overly_broad' ELSE 'normal' END AS anomaly_type
       FROM role_counts rc, avg_count ac
       WHERE rc.perm_count > ac.avg * $2
       ORDER BY rc.perm_count DESC`,
      [request.tenantId, BROAD_ROLE_THRESHOLD_MULTIPLIER]
    );

    // Recent denial spikes (permission denials in the last 24 hours)
    const { rows: denialSpikes } = await pool.query(
      `SELECT permission_name, count(*) AS denial_count
       FROM permission_audit_logs
       WHERE tenant_id = $1
         AND granted = false
         AND checked_at >= now() - interval '24 hours'
       GROUP BY permission_name
       HAVING count(*) > $2
       ORDER BY denial_count DESC`,
      [request.tenantId, DENIAL_SPIKE_THRESHOLD]
    );

    return reply.send({
      broad_roles: broadRoles,
      denial_spikes: denialSpikes,
      evaluated_at: new Date().toISOString(),
    });
  });

  // POST /permission-audit/log  — internal endpoint to record a permission check
  fastify.post('/log', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { permission_name, resource_type, resource_id, granted, denial_reason } =
      request.body as {
        permission_name: string;
        resource_type?: string;
        resource_id?: string;
        granted: boolean;
        denial_reason?: string;
      };

    const { rows } = await pool.query(
      `INSERT INTO permission_audit_logs
         (tenant_id, actor_id, permission_name, resource_type, resource_id,
          granted, denial_reason, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        request.tenantId,
        request.user.sub,
        permission_name,
        resource_type ?? null,
        resource_id ?? null,
        granted,
        denial_reason ?? null,
        request.ip,
        request.headers['user-agent'] ?? null,
      ]
    );
    return reply.status(201).send(rows[0]);
  });
}
