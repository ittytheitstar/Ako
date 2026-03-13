-- Phase 5 – Extensibility, Ecosystem & Intelligent Automation

-- ─── Plugins ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plugins (
  plugin_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  plugin_type    TEXT NOT NULL DEFAULT 'ui',  -- ui|backend|automation
  api_version    TEXT NOT NULL DEFAULT '1',
  permission_scopes TEXT[] NOT NULL DEFAULT '{}',
  author         TEXT,
  homepage_url   TEXT,
  status         TEXT NOT NULL DEFAULT 'disabled', -- disabled|enabled|error
  enabled_contexts JSONB NOT NULL DEFAULT '[]'::jsonb, -- course/tenant/global contexts
  resource_limits JSONB NOT NULL DEFAULT '{}'::jsonb, -- cpu_ms, memory_mb, etc.
  installed_by   UUID REFERENCES users(user_id),
  installed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS plugin_versions (
  version_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id      UUID NOT NULL REFERENCES plugins(plugin_id) ON DELETE CASCADE,
  version        TEXT NOT NULL,
  changelog      TEXT,
  bundle_url     TEXT,
  bundle_hash    TEXT,  -- SHA-256 for integrity verification
  is_current     BOOLEAN NOT NULL DEFAULT FALSE,
  published_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plugin_id, version)
);

-- ─── Webhooks ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhooks (
  webhook_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  target_url     TEXT NOT NULL,
  event_types    TEXT[] NOT NULL DEFAULT '{}',  -- e.g. plugin.enabled, automation.triggered
  secret         TEXT,  -- HMAC secret for signature verification
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES users(user_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_fired_at  TIMESTAMPTZ,
  failure_count  INT NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  delivery_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id     UUID NOT NULL REFERENCES webhooks(webhook_id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending|delivered|failed
  http_status    INT,
  response_body  TEXT,
  attempt        INT NOT NULL DEFAULT 1,
  fired_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_retry_at  TIMESTAMPTZ
);

-- ─── Integration Connectors ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_connectors (
  connector_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  connector_type TEXT NOT NULL,  -- sis|sms|identity|assessment|content|analytics
  settings       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'disconnected', -- connected|disconnected|error
  health_status  TEXT NOT NULL DEFAULT 'unknown', -- healthy|degraded|unhealthy|unknown
  last_health_check TIMESTAMPTZ,
  latency_ms     INT,
  error_message  TEXT,
  created_by     UUID REFERENCES users(user_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- ─── Automation Rules ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_rules (
  rule_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  trigger_event  TEXT NOT NULL,  -- e.g. enrolment.created, grade.updated
  conditions     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of {field, op, value}
  actions        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of {type, params}
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  trigger_count  INT NOT NULL DEFAULT 0,
  created_by     UUID REFERENCES users(user_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS automation_logs (
  log_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id        UUID NOT NULL REFERENCES automation_rules(rule_id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  trigger_event  TEXT NOT NULL,
  trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions_taken  JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome        TEXT NOT NULL DEFAULT 'success', -- success|skipped|error
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Feature Flags ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_flags (
  flag_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = global
  name           TEXT NOT NULL,
  description    TEXT,
  enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_pct    INT NOT NULL DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  context        TEXT NOT NULL DEFAULT 'global', -- global|tenant|course
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_by     UUID REFERENCES users(user_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- ─── Developer API Keys ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS developer_api_keys (
  key_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  key_hash       TEXT NOT NULL UNIQUE,  -- bcrypt/SHA-256 of actual key
  key_prefix     TEXT NOT NULL,         -- first 8 chars shown in UI
  scopes         TEXT[] NOT NULL DEFAULT '{}',
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, user_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_plugins_tenant ON plugins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_integration_connectors_tenant ON integration_connectors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant ON automation_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant ON feature_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_tenant ON developer_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_user ON developer_api_keys(user_id);
