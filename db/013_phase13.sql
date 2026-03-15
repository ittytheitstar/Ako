-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 13 – Competencies, Outcomes & Programme-Level Tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── competency_frameworks ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS competency_frameworks (
  framework_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  version       TEXT        NOT NULL DEFAULT '1.0',
  source        TEXT        NOT NULL DEFAULT 'manual'
                            CHECK(source IN ('manual','csv','case')),
  description   TEXT,
  created_by    UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cf_tenant ON competency_frameworks(tenant_id);

-- ─── competencies ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS competencies (
  competency_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id  UUID        NOT NULL REFERENCES competency_frameworks(framework_id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  parent_id     UUID        REFERENCES competencies(competency_id) ON DELETE CASCADE,
  short_name    TEXT        NOT NULL,
  description   TEXT,
  idnumber      TEXT,
  level         INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_framework  ON competencies(framework_id);
CREATE INDEX IF NOT EXISTS idx_comp_tenant     ON competencies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_parent     ON competencies(parent_id);

-- ─── course_competency_links ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_competency_links (
  link_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id              UUID        NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  competency_id          UUID        NOT NULL REFERENCES competencies(competency_id) ON DELETE CASCADE,
  proficiency_expectation TEXT       NOT NULL DEFAULT 'developing'
                           CHECK(proficiency_expectation IN ('introduced','developing','demonstrated','mastered')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, competency_id)
);

CREATE INDEX IF NOT EXISTS idx_ccl_course      ON course_competency_links(course_id);
CREATE INDEX IF NOT EXISTS idx_ccl_competency  ON course_competency_links(competency_id);

-- ─── activity_competency_links ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_competency_links (
  link_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  module_id     UUID        NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  competency_id UUID        NOT NULL REFERENCES competencies(competency_id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_id, competency_id)
);

CREATE INDEX IF NOT EXISTS idx_acl_module     ON activity_competency_links(module_id);
CREATE INDEX IF NOT EXISTS idx_acl_competency ON activity_competency_links(competency_id);

-- ─── competency_evidence ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS competency_evidence (
  evidence_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  competency_id      UUID        NOT NULL REFERENCES competencies(competency_id) ON DELETE CASCADE,
  user_id            UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id          UUID        REFERENCES courses(course_id) ON DELETE SET NULL,
  source_type        TEXT        NOT NULL
                     CHECK(source_type IN ('assignment','quiz','teacher_judgment','portfolio')),
  source_id          UUID,
  proficiency_rating TEXT        NOT NULL
                     CHECK(proficiency_rating IN ('not_yet','beginning','developing','proficient','advanced')),
  rating_source      TEXT        NOT NULL DEFAULT 'automatic'
                     CHECK(rating_source IN ('automatic','teacher')),
  evidence_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes              TEXT,
  created_by         UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ce_tenant      ON competency_evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ce_user        ON competency_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_ce_competency  ON competency_evidence(competency_id);
CREATE INDEX IF NOT EXISTS idx_ce_course      ON competency_evidence(course_id);

-- ─── competency_profiles ──────────────────────────────────────────────────────
-- Aggregated proficiency per (user, competency) for fast querying.

CREATE TABLE IF NOT EXISTS competency_profiles (
  profile_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id              UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  competency_id        UUID        NOT NULL REFERENCES competencies(competency_id) ON DELETE CASCADE,
  proficiency_rating   TEXT        NOT NULL DEFAULT 'not_yet'
                       CHECK(proficiency_rating IN ('not_yet','beginning','developing','proficient','advanced')),
  aggregation_strategy TEXT        NOT NULL DEFAULT 'latest'
                       CHECK(aggregation_strategy IN ('latest','highest','average','manual')),
  evidence_count       INT         NOT NULL DEFAULT 0,
  last_evidence_at     TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, competency_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_tenant      ON competency_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cp_user        ON competency_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_cp_competency  ON competency_profiles(competency_id);

-- ─── programmes ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programmes (
  programme_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  code          TEXT        NOT NULL,
  description   TEXT,
  framework_id  UUID        REFERENCES competency_frameworks(framework_id) ON DELETE SET NULL,
  course_ids    UUID[]      NOT NULL DEFAULT '{}',
  settings      JSONB       NOT NULL DEFAULT '{}',
  created_by    UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_prog_tenant     ON programmes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prog_framework  ON programmes(framework_id);

-- ─── programme_competency_reports ─────────────────────────────────────────────
-- Pre-computed report snapshots refreshed nightly or on demand.

CREATE TABLE IF NOT EXISTS programme_competency_reports (
  report_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  programme_id       UUID        NOT NULL REFERENCES programmes(programme_id) ON DELETE CASCADE,
  competency_id      UUID        NOT NULL REFERENCES competencies(competency_id) ON DELETE CASCADE,
  total_learners     INT         NOT NULL DEFAULT 0,
  not_yet_count      INT         NOT NULL DEFAULT 0,
  beginning_count    INT         NOT NULL DEFAULT 0,
  developing_count   INT         NOT NULL DEFAULT 0,
  proficient_count   INT         NOT NULL DEFAULT 0,
  advanced_count     INT         NOT NULL DEFAULT 0,
  proficient_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
  refreshed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(programme_id, competency_id)
);

CREATE INDEX IF NOT EXISTS idx_pcr_programme   ON programme_competency_reports(programme_id);
CREATE INDEX IF NOT EXISTS idx_pcr_competency  ON programme_competency_reports(competency_id);
