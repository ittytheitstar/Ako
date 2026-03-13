-- =============================================================================
-- Migration: 003_phase2.sql
-- Description: Phase 2 additions — course lifecycle, terms, groups, groupings,
--              and enrolment methods for the Ako LMS project.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 & 2. Add course lifecycle columns to `courses`
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'courses'::regclass AND attname = 'status' AND NOT attisdropped
  ) THEN
    ALTER TABLE courses ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'published'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'courses'::regclass AND attname = 'published_at' AND NOT attisdropped
  ) THEN
    ALTER TABLE courses ADD COLUMN published_at TIMESTAMPTZ;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Terms — academic / scheduling periods scoped to a tenant
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terms (
  term_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  code       TEXT        NOT NULL,
  start_date DATE,
  end_date   DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- -----------------------------------------------------------------------------
-- 4. Add term_id FK to `courses`
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'courses'::regclass AND attname = 'term_id' AND NOT attisdropped
  ) THEN
    ALTER TABLE courses ADD COLUMN term_id UUID REFERENCES terms(term_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5 & 6. Add visibility / ordering columns to `course_modules`
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'course_modules'::regclass AND attname = 'hidden' AND NOT attisdropped
  ) THEN
    ALTER TABLE course_modules ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'course_modules'::regclass AND attname = 'position' AND NOT attisdropped
  ) THEN
    ALTER TABLE course_modules ADD COLUMN position INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Course groups — sub-divisions of a course, optionally tied to a cohort
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_groups (
  group_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(tenant_id)  ON DELETE CASCADE,
  course_id  UUID        NOT NULL REFERENCES courses(course_id)  ON DELETE CASCADE,
  cohort_id  UUID                 REFERENCES cohorts(cohort_id)  ON DELETE SET NULL,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, name)
);

-- -----------------------------------------------------------------------------
-- 8. Course group members — users assigned to a course group
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_group_members (
  group_id UUID NOT NULL REFERENCES course_groups(group_id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(user_id)          ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 9. Course groupings — named collections of groups within a course
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_groupings (
  grouping_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id   UUID        NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, name)
);

-- -----------------------------------------------------------------------------
-- 10. Course grouping groups — many-to-many between groupings and groups
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_grouping_groups (
  grouping_id UUID NOT NULL REFERENCES course_groupings(grouping_id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES course_groups(group_id)       ON DELETE CASCADE,
  PRIMARY KEY (grouping_id, group_id)
);

-- -----------------------------------------------------------------------------
-- 11. Enrolment methods — defines how users are enrolled into a course
--     method_type: 'manual' | 'cohort_sync'
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrolment_methods (
  method_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(tenant_id)  ON DELETE CASCADE,
  course_id    UUID        NOT NULL REFERENCES courses(course_id)  ON DELETE CASCADE,
  method_type  TEXT        NOT NULL CHECK (method_type IN ('manual', 'cohort_sync')),
  cohort_id    UUID                 REFERENCES cohorts(cohort_id)  ON DELETE CASCADE,
  default_role TEXT        NOT NULL DEFAULT 'student',
  create_group BOOLEAN     NOT NULL DEFAULT FALSE,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, method_type, cohort_id)
);

-- -----------------------------------------------------------------------------
-- 12. Add FK on enrolments.group_id → course_groups
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'enrolments'::regclass AND conname = 'enrolments_group_id_fkey'
  ) THEN
    ALTER TABLE enrolments
      ADD CONSTRAINT enrolments_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES course_groups(group_id) ON DELETE SET NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 13. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_courses_status
  ON courses (status)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_course_groups_course
  ON course_groups (course_id);

CREATE INDEX IF NOT EXISTS idx_course_groupings_course
  ON course_groupings (course_id);

CREATE INDEX IF NOT EXISTS idx_enrolment_methods_course
  ON enrolment_methods (course_id);
