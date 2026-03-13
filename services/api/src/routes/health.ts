import { FastifyInstance } from 'fastify';
import { pool } from '../db/client';

export async function healthRoutes(fastify: FastifyInstance) {
  // GET /health  — legacy combined health check (kept for backward compatibility)
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

  // GET /health/live  — liveness probe (is the process alive and not deadlocked?)
  fastify.get('/health/live', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /health/ready  — readiness probe (are all dependencies available?)
  fastify.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, { status: 'ok' | 'error'; latency_ms?: number; detail?: string }> = {};
    let allOk = true;

    // Database check
    try {
      const t0 = Date.now();
      await pool.query('SELECT 1');
      checks['database'] = { status: 'ok', latency_ms: Date.now() - t0 };
    } catch (err) {
      checks['database'] = { status: 'error', detail: (err as Error).message };
      allOk = false;
    }

    // Redis check
    if (fastify.redis) {
      try {
        const t0 = Date.now();
        await fastify.redis.ping();
        checks['redis'] = { status: 'ok', latency_ms: Date.now() - t0 };
      } catch (err) {
        checks['redis'] = { status: 'error', detail: (err as Error).message };
        allOk = false;
      }
    } else {
      checks['redis'] = { status: 'error', detail: 'Redis not configured' };
      allOk = false;
    }

    const statusCode = allOk ? 200 : 503;
    return reply.status(statusCode).send({
      status: allOk ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  // GET /health/startup  — startup probe (have migrations run? is seed data present?)
  fastify.get('/health/startup', async (_request, reply) => {
    const checks: Record<string, { status: 'ok' | 'error'; detail?: string }> = {};
    let allOk = true;

    const ALLOWED_TABLES = ['tenants', 'users', 'courses', 'enrolments'] as const;
    for (const table of ALLOWED_TABLES) {
      // table names are from a static allowlist, safe to interpolate
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
        checks[`table_${table}`] = { status: 'ok' };
      } catch (err) {
        checks[`table_${table}`] = { status: 'error', detail: (err as Error).message };
        allOk = false;
      }
    }

    const statusCode = allOk ? 200 : 503;
    return reply.status(statusCode).send({
      status: allOk ? 'ok' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
