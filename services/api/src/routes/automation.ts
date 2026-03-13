import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const conditionSchema = z.object({
  field: z.string(),
  op: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'in']),
  value: z.unknown(),
});

const actionSchema = z.object({
  type: z.string(),  // e.g. send_notification, send_email, create_task
  params: z.record(z.unknown()).default({}),
});

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  trigger_event: z.string().min(1),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).default([]),
  active: z.boolean().default(true),
});

export async function automationRoutes(fastify: FastifyInstance) {
  // List automation rules
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM automation_rules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // Create automation rule
  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = ruleSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO automation_rules
         (tenant_id, name, description, trigger_event, conditions, actions, active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        request.tenantId,
        body.data.name,
        body.data.description,
        body.data.trigger_event,
        JSON.stringify(body.data.conditions),
        JSON.stringify(body.data.actions),
        body.data.active,
        request.user.sub,
      ]
    );
    return reply.status(201).send(rows[0]);
  });

  // Get automation rule
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM automation_rules WHERE rule_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Automation rule not found');
    return reply.send(rows[0]);
  });

  // Update automation rule
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ruleSchema.partial().safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (body.data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(body.data.name); }
    if (body.data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(body.data.description); }
    if (body.data.trigger_event !== undefined) { fields.push(`trigger_event = $${idx++}`); values.push(body.data.trigger_event); }
    if (body.data.conditions !== undefined) { fields.push(`conditions = $${idx++}`); values.push(JSON.stringify(body.data.conditions)); }
    if (body.data.actions !== undefined) { fields.push(`actions = $${idx++}`); values.push(JSON.stringify(body.data.actions)); }
    if (body.data.active !== undefined) { fields.push(`active = $${idx++}`); values.push(body.data.active); }
    if (fields.length === 0) throw BadRequest('No fields to update');
    fields.push('updated_at = now()');
    values.push(id, request.tenantId);

    const { rows } = await pool.query(
      `UPDATE automation_rules SET ${fields.join(', ')}
       WHERE rule_id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) throw NotFound('Automation rule not found');
    return reply.send(rows[0]);
  });

  // Delete automation rule
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM automation_rules WHERE rule_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('Automation rule not found');
    return reply.status(204).send();
  });

  // Get automation logs for a rule
  fastify.get('/:id/logs', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT al.* FROM automation_logs al
       JOIN automation_rules ar ON ar.rule_id = al.rule_id
       WHERE al.rule_id = $1 AND ar.tenant_id = $2
       ORDER BY al.created_at DESC LIMIT 100`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });
}
