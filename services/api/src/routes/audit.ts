import { FastifyInstance } from 'fastify';
import { pool } from '../db/client';

export async function auditRoutes(fastify: FastifyInstance) {
  // List audit events
  fastify.get('/events', { preHandler: fastify.authenticate }, async (request, reply) => {
    const {
      cursor,
      limit = 50,
      event_type,
      resource_type,
      resource_id,
      actor_id,
    } = request.query as {
      cursor?: string;
      limit?: number;
      event_type?: string;
      resource_type?: string;
      resource_id?: string;
      actor_id?: string;
    };

    const params: unknown[] = [request.tenantId];
    const conditions: string[] = ['ae.tenant_id = $1'];
    let i = 2;

    if (cursor) { conditions.push(`ae.event_id < $${i++}`); params.push(cursor); }
    if (event_type) { conditions.push(`ae.event_type = $${i++}`); params.push(event_type); }
    if (resource_type) { conditions.push(`ae.resource_type = $${i++}`); params.push(resource_type); }
    if (resource_id) { conditions.push(`ae.resource_id = $${i++}`); params.push(resource_id); }
    if (actor_id) { conditions.push(`ae.actor_id = $${i++}`); params.push(actor_id); }

    params.push(Math.min(Number(limit), 200));

    const { rows } = await pool.query(
      `SELECT ae.*, u.display_name AS actor_name, u.email AS actor_email
       FROM audit_events ae
       LEFT JOIN users u ON u.user_id = ae.actor_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ae.created_at DESC
       LIMIT $${i}`,
      params
    );

    return reply.send({
      data: rows,
      nextCursor: rows.length === Number(limit) ? rows[rows.length - 1].event_id : undefined,
    });
  });

  // Also expose legacy audit_log entries
  fastify.get('/log', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { cursor, limit = 50 } = request.query as { cursor?: string; limit?: number };
    const params: unknown[] = [request.tenantId, Math.min(Number(limit), 200)];
    let query = `SELECT al.*, u.display_name AS actor_name
                 FROM audit_log al
                 LEFT JOIN users u ON u.user_id = al.actor_id
                 WHERE al.tenant_id = $1`;
    if (cursor) { query += ` AND al.audit_id < $3`; params.push(cursor); }
    query += ` ORDER BY al.created_at DESC LIMIT $2`;
    const { rows } = await pool.query(query, params);
    return reply.send({
      data: rows,
      nextCursor: rows.length === Number(limit) ? rows[rows.length - 1].audit_id : undefined,
    });
  });
}
