-- Phase 8 – Completion Tracking & Learning Pathways

-- ─── Activity Completion Rules ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_completion_rules (
  rule_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  module_id                UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  completion_type          TEXT NOT NULL CHECK (completion_type IN ('view','submit','grade','post','manual','teacher')),
  passing_grade            NUMERIC(5,2),            -- required when completion_type = 'grade'
  require_view             BOOLEAN NOT NULL DEFAULT false,
  expected_completion_date DATE,                    -- target hint for learners
  created_by               UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id)       -- one rule per module
);

-- ─── Activity Completion States ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_completion_states (
  state_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  module_id          UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  state              TEXT NOT NULL DEFAULT 'incomplete'
                       CHECK (state IN ('incomplete','complete','complete_pass','complete_fail')),
  completed_at       TIMESTAMPTZ,
  completion_source  TEXT,                  -- view | submit | grade | post | manual | teacher
  overridden_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_acs_user_tenant  ON activity_completion_states(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_acs_module       ON activity_completion_states(module_id);

-- ─── Course Completion Criteria ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_completion_criteria (
  criterion_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  criterion_type TEXT NOT NULL
                  CHECK (criterion_type IN ('required_modules','min_grade','required_date','all_modules')),
  -- settings examples:
  --   required_modules: { "module_ids": ["..."] }
  --   min_grade:        { "grade_item_ids": ["..."], "min_grade": 60 }
  --   required_date:    { "required_date": "2026-06-30" }
  --   all_modules:      {}
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccc_course ON course_completion_criteria(course_id);

-- ─── Course Completion States ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_completion_states (
  ccs_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id          UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  state              TEXT NOT NULL DEFAULT 'incomplete'
                       CHECK (state IN ('incomplete','in_progress','complete')),
  progress_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 0–100
  completed_at       TIMESTAMPTZ,
  last_evaluated_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ccs_user_tenant  ON course_completion_states(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ccs_course       ON course_completion_states(course_id);
