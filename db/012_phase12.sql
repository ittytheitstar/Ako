-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 12 — Course Templates, Backup, Restore & Course Copy
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Template columns on courses ─────────────────────────────────────────────

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_template          BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_category    TEXT,
  ADD COLUMN IF NOT EXISTS template_tags        TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS template_description TEXT;

CREATE INDEX IF NOT EXISTS idx_courses_is_template ON courses(tenant_id, is_template)
  WHERE is_template = true;

-- ─── copy_jobs ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS copy_jobs (
  job_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  source_course_id  UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  target_course_id  UUID REFERENCES courses(course_id) ON DELETE SET NULL,
  options           JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','running','complete','failed')),
  error_message     TEXT,
  created_by        UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_copy_jobs_tenant        ON copy_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_copy_jobs_source        ON copy_jobs(source_course_id);
CREATE INDEX IF NOT EXISTS idx_copy_jobs_target        ON copy_jobs(target_course_id);
CREATE INDEX IF NOT EXISTS idx_copy_jobs_created_by    ON copy_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_copy_jobs_status        ON copy_jobs(tenant_id, status);

-- ─── backup_jobs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS backup_jobs (
  job_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id        UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  options          JSONB NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK(status IN ('pending','running','complete','failed')),
  error_message    TEXT,
  file_path        TEXT,
  file_size_bytes  BIGINT,
  created_by       UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backup_jobs_tenant      ON backup_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_course      ON backup_jobs(course_id);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_created_by  ON backup_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_status      ON backup_jobs(tenant_id, status);

-- ─── restore_jobs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS restore_jobs (
  job_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  target_course_id  UUID REFERENCES courses(course_id) ON DELETE SET NULL,
  source_file_path  TEXT,
  manifest_version  TEXT,
  options           JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','running','complete','failed')),
  error_message     TEXT,
  warnings          TEXT[] NOT NULL DEFAULT '{}',
  created_by        UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_restore_jobs_tenant      ON restore_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restore_jobs_target      ON restore_jobs(target_course_id);
CREATE INDEX IF NOT EXISTS idx_restore_jobs_created_by  ON restore_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_restore_jobs_status      ON restore_jobs(tenant_id, status);
