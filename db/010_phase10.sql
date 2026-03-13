-- Phase 10 – Calendar, Deadlines & Academic Scheduling

-- ─── Calendar Events ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_events (
  event_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  start_at              TIMESTAMPTZ NOT NULL,
  end_at                TIMESTAMPTZ,
  all_day               BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule       TEXT,        -- RFC 5545 RRULE string
  recurrence_exceptions TIMESTAMPTZ[] NOT NULL DEFAULT '{}',  -- EXDATE list
  context_type          TEXT NOT NULL DEFAULT 'system' CHECK (context_type IN ('course','cohort','system')),
  context_id            UUID,
  source_type           TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('assignment','quiz','announcement','term','manual')),
  source_id             UUID,
  visibility            TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','grouping','private')),
  grouping_id           UUID,
  created_by            UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cal_events_tenant      ON calendar_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cal_events_context     ON calendar_events(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_cal_events_source      ON calendar_events(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_cal_events_range       ON calendar_events(tenant_id, start_at, end_at);

-- ─── Calendar Reminder Preferences ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_reminder_prefs (
  pref_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,   -- assignment | quiz | course_event | cohort_event | system
  enabled       BOOLEAN NOT NULL DEFAULT true,
  intervals     INT[] NOT NULL DEFAULT '{1440,4320,10080}',  -- minutes before: 1d, 3d, 7d
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_cal_reminder_prefs_user ON calendar_reminder_prefs(tenant_id, user_id);

-- ─── Calendar Reminder Log (deduplication) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_reminder_log (
  log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES calendar_events(event_id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  window_minutes INT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, window_minutes)
);

CREATE INDEX IF NOT EXISTS idx_cal_reminder_log_event ON calendar_reminder_log(event_id);

-- ─── External Calendar Sources ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_calendar_sources (
  source_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  sync_interval_minutes INT NOT NULL DEFAULT 60,
  last_synced_at TIMESTAMPTZ,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ext_cal_sources_tenant ON external_calendar_sources(tenant_id);

-- ─── External Calendar Events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_calendar_events (
  ext_event_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  source_id     UUID NOT NULL REFERENCES external_calendar_sources(source_id) ON DELETE CASCADE,
  uid           TEXT NOT NULL,   -- UID from iCal VEVENT
  title         TEXT NOT NULL,
  description   TEXT,
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ,
  all_day       BOOLEAN NOT NULL DEFAULT false,
  raw_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_ext_cal_events_source  ON external_calendar_events(source_id);
CREATE INDEX IF NOT EXISTS idx_ext_cal_events_range   ON external_calendar_events(tenant_id, start_at, end_at);
