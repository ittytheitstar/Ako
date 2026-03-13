-- Phase 4 – Archiving, Records, Analytics & Governance

-- Extend courses.status CHECK constraint to include Phase 4 lifecycle values
-- (Phase 2 added the column with CHECK (status IN ('draft','published')))
DO $$ BEGIN
  ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_status_check;
  ALTER TABLE courses ADD CONSTRAINT courses_status_check
    CHECK (status IN ('draft', 'published', 'completed', 'archived', 'deleted'));
END $$;

-- Add Phase 4 columns to courses (status column already exists from Phase 2)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS policy_id UUID;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;

-- Retention policies
CREATE TABLE IF NOT EXISTS retention_policies (
  policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  course_type TEXT,             -- optional filter: e.g. 'vocational', 'academic'
  programme TEXT,               -- optional filter: e.g. 'NZ2992'
  regulatory_requirement TEXT,  -- e.g. 'NZQA-7yr', 'GDPR-6yr'
  retention_months INT NOT NULL DEFAULT 84, -- 7 years default
  access_level TEXT NOT NULL DEFAULT 'read_only', -- read_only|restricted|none
  disposal_action TEXT NOT NULL DEFAULT 'archive', -- archive|delete|export
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- Course archives (snapshot metadata)
CREATE TABLE IF NOT EXISTS course_archives (
  archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  archived_by UUID REFERENCES users(user_id),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  restored_at TIMESTAMPTZ,
  restored_by UUID REFERENCES users(user_id),
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- manual|scheduled|cohort_end|course_end
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,  -- course metadata snapshot
  integrity_hash TEXT,          -- SHA-256 of snapshot for verification
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT
);

-- Analytics snapshots (pre-aggregated, read-only store)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(course_id) ON DELETE SET NULL,
  cohort_id UUID REFERENCES cohorts(cohort_id) ON DELETE SET NULL,
  snapshot_type TEXT NOT NULL,  -- enrolments|activity|forum_engagement|completion
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Export jobs
CREATE TABLE IF NOT EXISTS export_jobs (
  export_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(course_id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES users(user_id),
  export_type TEXT NOT NULL,    -- course_archive|assessment_evidence|engagement_metrics
  status TEXT NOT NULL DEFAULT 'pending', -- pending|running|completed|failed
  file_key TEXT,                -- storage key for completed export
  file_size_bytes BIGINT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,       -- download link expiry
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Audit events (Phase 4 governance – complements existing audit_log)
CREATE TABLE IF NOT EXISTS audit_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(user_id),
  event_type TEXT NOT NULL,     -- course.archived|course.restored|retention.applied|export.started|etc.
  resource_type TEXT,           -- course|export_job|retention_policy
  resource_id UUID,
  ip INET,
  user_agent TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant ON retention_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_course_archives_course ON course_archives(course_id);
CREATE INDEX IF NOT EXISTS idx_course_archives_tenant ON course_archives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_course ON analytics_snapshots(course_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_type ON analytics_snapshots(snapshot_type, period_start);
CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant ON export_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant ON audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
-- Replace the Phase 2 partial index (WHERE archived_at IS NULL) with a full index
-- now that Phase 4 needs to query courses in all lifecycle states by status
DROP INDEX IF EXISTS idx_courses_status;
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
