-- Phase 6 – Platform Hardening, Observability & Security

-- ─── Rate Limit Configurations ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_limit_configs (
  config_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = global default
  route_pattern    TEXT,              -- NULL = applies to all routes for this tenant
  window_seconds   INT NOT NULL DEFAULT 60,
  max_requests     INT NOT NULL DEFAULT 200,
  max_write_requests INT,             -- NULL = same as max_requests
  burst_multiplier NUMERIC(3,1) NOT NULL DEFAULT 1.5,
  scope            TEXT NOT NULL DEFAULT 'tenant', -- global|tenant|api_key
  notes            TEXT,
  created_by       UUID REFERENCES users(user_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, route_pattern)
);

-- ─── Permission Audit Logs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permission_audit_logs (
  audit_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id         UUID REFERENCES users(user_id) ON DELETE SET NULL,
  permission_name  TEXT NOT NULL,
  resource_type    TEXT,
  resource_id      TEXT,
  granted          BOOLEAN NOT NULL,
  denial_reason    TEXT,             -- populated when granted = false
  ip               INET,
  user_agent       TEXT,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Metric Snapshots ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS metric_snapshots (
  snapshot_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = platform-wide
  metric_name      TEXT NOT NULL,        -- e.g. http_requests_total, db_pool_active
  value            NUMERIC NOT NULL,
  labels           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {route, method, status_code, ...}
  period_start     TIMESTAMPTZ NOT NULL,
  period_end       TIMESTAMPTZ NOT NULL,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── System Alerts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_alerts (
  alert_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = global
  name             TEXT NOT NULL,
  description      TEXT,
  metric_name      TEXT NOT NULL,         -- metric to evaluate
  threshold_value  NUMERIC NOT NULL,
  comparison       TEXT NOT NULL DEFAULT 'gt', -- gt|gte|lt|lte|eq
  window_seconds   INT NOT NULL DEFAULT 300,   -- evaluation window
  severity         TEXT NOT NULL DEFAULT 'warning', -- info|warning|critical
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  notify_channels  TEXT[] NOT NULL DEFAULT '{platform}', -- platform|webhook|email
  last_evaluated_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  trigger_count    INT NOT NULL DEFAULT 0,
  resolved_at      TIMESTAMPTZ,
  created_by       UUID REFERENCES users(user_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS system_alert_events (
  event_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id         UUID NOT NULL REFERENCES system_alerts(alert_id) ON DELETE CASCADE,
  tenant_id        UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  metric_value     NUMERIC NOT NULL,
  threshold_value  NUMERIC NOT NULL,
  severity         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'triggered', -- triggered|resolved
  message          TEXT,
  triggered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_tenant ON rate_limit_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_tenant ON permission_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_actor ON permission_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_checked_at ON permission_audit_logs(checked_at);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_permission ON permission_audit_logs(permission_name);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_tenant_metric ON metric_snapshots(tenant_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_period ON metric_snapshots(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_system_alerts_tenant ON system_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_alert_events_alert ON system_alert_events(alert_id);
CREATE INDEX IF NOT EXISTS idx_system_alert_events_triggered_at ON system_alert_events(triggered_at);
