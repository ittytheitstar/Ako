import { FastifyInstance } from 'fastify';
import { pool } from '../db/client';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          database: 'ok',
          redis: fastify.redis ? 'ok' : 'unavailable',
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        services: {
          database: 'error',
        },
      });
    }
  });
}
