import { FastifyInstance } from 'fastify';
import { pool } from '../db/client';

// In-process counters (reset on restart; for persistent trends use metric_snapshots)
const counters: Record<string, number> = {
  http_requests_total: 0,
  http_requests_errors_total: 0,
};

const latencyBuckets: number[] = [];

export function incrementRequestCounter() {
  counters['http_requests_total'] = (counters['http_requests_total'] ?? 0) + 1;
}

export function incrementErrorCounter() {
  counters['http_requests_errors_total'] = (counters['http_requests_errors_total'] ?? 0) + 1;
}

export function recordLatency(ms: number) {
  latencyBuckets.push(ms);
  if (latencyBuckets.length > 10000) latencyBuckets.shift();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function buildPrometheusText(stats: {
  httpRequestsTotal: number;
  httpRequestsErrors: number;
  p50: number;
  p95: number;
  p99: number;
  dbPoolActive: number;
  uptime: number;
}): string {
  const lines: string[] = [
    '# HELP ako_http_requests_total Total HTTP requests handled',
    '# TYPE ako_http_requests_total counter',
    `ako_http_requests_total ${stats.httpRequestsTotal}`,
    '',
    '# HELP ako_http_requests_errors_total Total HTTP requests that resulted in 5xx',
    '# TYPE ako_http_requests_errors_total counter',
    `ako_http_requests_errors_total ${stats.httpRequestsErrors}`,
    '',
    '# HELP ako_http_request_duration_ms Request latency in milliseconds',
    '# TYPE ako_http_request_duration_ms summary',
    `ako_http_request_duration_ms{quantile="0.5"} ${stats.p50}`,
    `ako_http_request_duration_ms{quantile="0.95"} ${stats.p95}`,
    `ako_http_request_duration_ms{quantile="0.99"} ${stats.p99}`,
    '',
    '# HELP ako_db_pool_active_connections Active database pool connections',
    '# TYPE ako_db_pool_active_connections gauge',
    `ako_db_pool_active_connections ${stats.dbPoolActive}`,
    '',
    '# HELP ako_process_uptime_seconds Process uptime in seconds',
    '# TYPE ako_process_uptime_seconds counter',
    `ako_process_uptime_seconds ${stats.uptime}`,
    '',
  ];
  return lines.join('\n');
}

export async function metricsRoutes(fastify: FastifyInstance) {
  // Instrument all requests via hook
  fastify.addHook('onResponse', (request, reply, done) => {
    incrementRequestCounter();
    const latency = reply.elapsedTime;
    if (typeof latency === 'number') recordLatency(latency);
    if (reply.statusCode >= 500) incrementErrorCounter();
    done();
  });

  // GET /metrics  — Prometheus text format (admin only)
  fastify.get('/metrics', { preHandler: fastify.authenticate }, async (request, reply) => {
    const sorted = [...latencyBuckets].sort((a, b) => a - b);

    let dbPoolActive = 0;
    try {
      const res = await pool.query<{ count: string }>(
        `SELECT count(*) FROM pg_stat_activity WHERE state = 'active'`
      );
      dbPoolActive = parseInt(res.rows[0]?.count ?? '0', 10);
    } catch {
      // non-fatal
    }

    const stats = {
      httpRequestsTotal: counters['http_requests_total'] ?? 0,
      httpRequestsErrors: counters['http_requests_errors_total'] ?? 0,
      p50: Math.round(percentile(sorted, 50)),
      p95: Math.round(percentile(sorted, 95)),
      p99: Math.round(percentile(sorted, 99)),
      dbPoolActive,
      uptime: Math.floor(process.uptime()),
    };

    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(buildPrometheusText(stats));
  });

  // GET /metrics/summary  — JSON summary for dashboard
  fastify.get('/metrics/summary', { preHandler: fastify.authenticate }, async (_request, reply) => {
    const sorted = [...latencyBuckets].sort((a, b) => a - b);

    let dbPoolActive = 0;
    let dbLatencyMs = 0;
    try {
      const t0 = Date.now();
      await pool.query('SELECT 1');
      dbLatencyMs = Date.now() - t0;
      const res = await pool.query<{ count: string }>(
        `SELECT count(*) FROM pg_stat_activity WHERE state = 'active'`
      );
      dbPoolActive = parseInt(res.rows[0]?.count ?? '0', 10);
    } catch {
      // non-fatal
    }

    const total = counters['http_requests_total'] ?? 0;
    const errors = counters['http_requests_errors_total'] ?? 0;

    return reply.send({
      http: {
        requests_total: total,
        errors_total: errors,
        error_rate_pct: total > 0 ? Math.round((errors / total) * 10000) / 100 : 0,
        latency_ms: {
          p50: Math.round(percentile(sorted, 50)),
          p95: Math.round(percentile(sorted, 95)),
          p99: Math.round(percentile(sorted, 99)),
        },
      },
      database: {
        pool_active_connections: dbPoolActive,
        ping_ms: dbLatencyMs,
      },
      process: {
        uptime_seconds: Math.floor(process.uptime()),
        memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      collected_at: new Date().toISOString(),
    });
  });

  // GET /metrics/snapshots  — historical metric snapshots
  fastify.get('/metrics/snapshots', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { metric_name, limit = '50' } = request.query as { metric_name?: string; limit?: string };
    const values: unknown[] = [request.tenantId, parseInt(limit, 10)];
    let filter = '';
    if (metric_name) {
      filter = ' AND metric_name = $3';
      values.push(metric_name);
    }
    const { rows } = await pool.query(
      `SELECT * FROM metric_snapshots
       WHERE (tenant_id = $1 OR tenant_id IS NULL)${filter}
       ORDER BY recorded_at DESC LIMIT $2`,
      values
    );
    return reply.send({ data: rows });
  });
}
