import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const registrationSchema = z.object({
  // lti_registrations columns: issuer, client_id, auth_login_url, auth_token_url, keyset_url, settings
  issuer: z.string().url(),
  client_id: z.string().min(1),
  auth_login_url: z.string().url(),
  auth_token_url: z.string().url(),
  keyset_url: z.string().url(),
  settings: z.record(z.unknown()).default({}),
});

export async function ltiRoutes(fastify: FastifyInstance) {
  fastify.get('/registrations', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM lti_registrations WHERE tenant_id = $1`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/registrations', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = registrationSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO lti_registrations (tenant_id, issuer, client_id, auth_login_url, auth_token_url, keyset_url, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [request.tenantId, body.data.issuer, body.data.client_id, body.data.auth_login_url, body.data.auth_token_url, body.data.keyset_url, JSON.stringify(body.data.settings)]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.get('/registrations/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM lti_registrations WHERE registration_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('LTI registration not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/registrations/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM lti_registrations WHERE registration_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('LTI registration not found');
    return reply.status(204).send();
  });

  // LTI 1.3 launch stub
  fastify.post('/launch', async (_request, reply) => {
    return reply.status(200).send({ message: 'LTI 1.3 launch endpoint - implementation pending' });
  });

  // JWKS endpoint for LTI tool public keys
  fastify.get('/jwks', async (_request, reply) => {
    return reply.send({ keys: [] });
  });
}
