-- Phase 9 – Advanced Assessment, Question Bank & Gradebook Depth

-- ─── Question Categories ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS question_categories (
  category_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id     UUID REFERENCES courses(course_id) ON DELETE CASCADE,  -- NULL = tenant-level
  parent_id     UUID REFERENCES question_categories(category_id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  created_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qcat_tenant  ON question_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qcat_course  ON question_categories(course_id);
CREATE INDEX IF NOT EXISTS idx_qcat_parent  ON question_categories(parent_id);

-- ─── Questions (question bank) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS questions (
  question_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id     UUID REFERENCES courses(course_id) ON DELETE CASCADE,  -- NULL = tenant-level
  category_id   UUID REFERENCES question_categories(category_id) ON DELETE SET NULL,
  qtype         TEXT NOT NULL CHECK (qtype IN ('mcq','multi','short','essay','match','truefalse')),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','deprecated')),
  tags          TEXT[] NOT NULL DEFAULT '{}',
  created_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  shared_at     TIMESTAMPTZ,
  shared_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_tenant    ON questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_questions_category  ON questions(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_status    ON questions(status);

-- ─── Question Versions (immutable snapshots) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS question_versions (
  version_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
  version_num   INT NOT NULL,
  prompt        JSONB NOT NULL,
  options       JSONB NOT NULL DEFAULT '{}'::jsonb,
  answer_key    JSONB NOT NULL DEFAULT '{}'::jsonb,
  points        NUMERIC(10,2) NOT NULL DEFAULT 1,
  created_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, version_num)
);

CREATE INDEX IF NOT EXISTS idx_qv_question  ON question_versions(question_id);

-- ─── Quiz Enhancements ────────────────────────────────────────────────────────

ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS time_limit_minutes     INT,
  ADD COLUMN IF NOT EXISTS open_at                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_attempts           INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS attempt_spacing_minutes INT,
  ADD COLUMN IF NOT EXISTS password               TEXT,
  ADD COLUMN IF NOT EXISTS grading_strategy       TEXT NOT NULL DEFAULT 'highest'
    CHECK (grading_strategy IN ('highest','average','latest','first')),
  ADD COLUMN IF NOT EXISTS behaviour_mode         TEXT NOT NULL DEFAULT 'deferred_feedback'
    CHECK (behaviour_mode IN ('deferred_feedback','interactive','immediate_feedback'));

-- ─── Quiz Question Pools (randomised selection) ───────────────────────────────

CREATE TABLE IF NOT EXISTS quiz_question_pools (
  pool_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id            UUID NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  tenant_id          UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  source_category_id UUID REFERENCES question_categories(category_id) ON DELETE SET NULL,
  pick_count         INT NOT NULL DEFAULT 1,
  pool_order         TEXT NOT NULL DEFAULT 'random' CHECK (pool_order IN ('random','fixed')),
  position           INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qqp_quiz  ON quiz_question_pools(quiz_id);

-- ─── Grade Categories ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grade_categories (
  category_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id            UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  parent_id            UUID REFERENCES grade_categories(category_id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  aggregation_strategy TEXT NOT NULL DEFAULT 'weighted_mean'
    CHECK (aggregation_strategy IN ('weighted_mean','simple_mean','sum','highest','lowest','mode')),
  drop_lowest          INT NOT NULL DEFAULT 0,
  weight               NUMERIC(5,2) NOT NULL DEFAULT 100,  -- percentage of total
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gcat_course   ON grade_categories(course_id);
CREATE INDEX IF NOT EXISTS idx_gcat_parent   ON grade_categories(parent_id);

-- ─── Grade Item Enhancements ──────────────────────────────────────────────────

ALTER TABLE grade_items
  ADD COLUMN IF NOT EXISTS category_id  UUID REFERENCES grade_categories(category_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight       NUMERIC(5,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extra_credit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS release_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grade_type   TEXT NOT NULL DEFAULT 'numerical'
    CHECK (grade_type IN ('numerical','scale','letter','pass_fail'));

-- ─── Grade Scales ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grade_scales (
  scale_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grade_scale_levels (
  level_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id    UUID NOT NULL REFERENCES grade_scales(scale_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,    -- e.g. "Excellent"
  value       INT NOT NULL,     -- ordinal position (higher = better)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsl_scale  ON grade_scale_levels(scale_id);

-- ─── Marking Workflow States ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marking_workflow_states (
  mws_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES grade_items(item_id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  state        TEXT NOT NULL DEFAULT 'unmarked'
    CHECK (state IN ('unmarked','in_progress','ready_for_release','released')),
  marker_id    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  moderator_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  notes        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mws_item    ON marking_workflow_states(item_id);
CREATE INDEX IF NOT EXISTS idx_mws_user    ON marking_workflow_states(user_id);
CREATE INDEX IF NOT EXISTS idx_mws_tenant  ON marking_workflow_states(tenant_id);
