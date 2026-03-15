-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 11 — Rich Activities
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Lessons ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lessons (
  lesson_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id          UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  tenant_id          UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  time_limit_minutes INT,
  max_attempts       INT NOT NULL DEFAULT 0,
  passing_grade      NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id)
);

CREATE INDEX IF NOT EXISTS idx_lessons_tenant    ON lessons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module    ON lessons(module_id);

CREATE TABLE IF NOT EXISTS lesson_pages (
  page_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  UUID NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL,
  page_type  TEXT NOT NULL CHECK(page_type IN ('content','question','end_of_lesson','branch_table')),
  title      TEXT NOT NULL,
  body       JSONB NOT NULL DEFAULT '{}',
  question   JSONB NOT NULL DEFAULT '{}',
  jump_target TEXT NOT NULL DEFAULT 'next',
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_pages_lesson   ON lesson_pages(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_pages_tenant   ON lesson_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lesson_pages_position ON lesson_pages(lesson_id, position);

CREATE TABLE IF NOT EXISTS lesson_attempts (
  attempt_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       UUID NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  current_page_id UUID REFERENCES lesson_pages(page_id) ON DELETE SET NULL,
  score           NUMERIC(5,2),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lesson_attempts_lesson ON lesson_attempts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_attempts_user   ON lesson_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_attempts_tenant ON lesson_attempts(tenant_id);

CREATE TABLE IF NOT EXISTS lesson_attempt_answers (
  answer_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES lesson_attempts(attempt_id) ON DELETE CASCADE,
  page_id    UUID NOT NULL REFERENCES lesson_pages(page_id) ON DELETE CASCADE,
  answer     JSONB NOT NULL DEFAULT '{}',
  correct    BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_answers_attempt ON lesson_attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_lesson_answers_page    ON lesson_attempt_answers(page_id);

-- ─── Choices ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS choices (
  choice_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id        UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL,
  question         TEXT NOT NULL,
  close_at         TIMESTAMPTZ,
  allow_update     BOOLEAN NOT NULL DEFAULT true,
  show_results     TEXT NOT NULL DEFAULT 'after_answer' CHECK(show_results IN ('after_answer','after_close','never')),
  multiple_select  BOOLEAN NOT NULL DEFAULT false,
  anonymous        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id)
);

CREATE INDEX IF NOT EXISTS idx_choices_tenant ON choices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_choices_module ON choices(module_id);

CREATE TABLE IF NOT EXISTS choice_options (
  option_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  choice_id  UUID NOT NULL REFERENCES choices(choice_id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL,
  text       TEXT NOT NULL,
  max_answers INT,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_choice_options_choice ON choice_options(choice_id);
CREATE INDEX IF NOT EXISTS idx_choice_options_tenant ON choice_options(tenant_id);

CREATE TABLE IF NOT EXISTS choice_answers (
  answer_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  choice_id  UUID NOT NULL REFERENCES choices(choice_id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL,
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  option_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(choice_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_choice_answers_choice ON choice_answers(choice_id);
CREATE INDEX IF NOT EXISTS idx_choice_answers_user   ON choice_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_choice_answers_tenant ON choice_answers(tenant_id);

-- ─── Glossary ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS glossary_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_glossary_cats_module ON glossary_categories(module_id);
CREATE INDEX IF NOT EXISTS idx_glossary_cats_tenant ON glossary_categories(tenant_id);

CREATE TABLE IF NOT EXISTS glossary_entries (
  entry_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL,
  term        TEXT NOT NULL,
  definition  TEXT NOT NULL,
  author_id   UUID REFERENCES users(user_id) ON DELETE SET NULL,
  category_id UUID REFERENCES glossary_categories(category_id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_glossary_entries_module  ON glossary_entries(module_id);
CREATE INDEX IF NOT EXISTS idx_glossary_entries_tenant  ON glossary_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_glossary_entries_author  ON glossary_entries(author_id);
CREATE INDEX IF NOT EXISTS idx_glossary_entries_cat     ON glossary_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_glossary_entries_status  ON glossary_entries(module_id, status);

CREATE TABLE IF NOT EXISTS glossary_entry_ratings (
  rating_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   UUID NOT NULL REFERENCES glossary_entries(entry_id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL,
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  rating     INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_glossary_ratings_entry  ON glossary_entry_ratings(entry_id);
CREATE INDEX IF NOT EXISTS idx_glossary_ratings_user   ON glossary_entry_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_glossary_ratings_tenant ON glossary_entry_ratings(tenant_id);

-- ─── Workshops ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workshops (
  workshop_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id            UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL,
  phase                TEXT NOT NULL DEFAULT 'setup' CHECK(phase IN ('setup','submission','assessment','grading','closed')),
  submission_end_at    TIMESTAMPTZ,
  assessment_end_at    TIMESTAMPTZ,
  peer_count           INT NOT NULL DEFAULT 3,
  submission_weight    NUMERIC(5,2) NOT NULL DEFAULT 50,
  assessment_weight    NUMERIC(5,2) NOT NULL DEFAULT 50,
  self_assessment      BOOLEAN NOT NULL DEFAULT false,
  allocation_strategy  TEXT NOT NULL DEFAULT 'random' CHECK(allocation_strategy IN ('random','manual')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id)
);

CREATE INDEX IF NOT EXISTS idx_workshops_tenant ON workshops(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workshops_module ON workshops(module_id);

CREATE TABLE IF NOT EXISTS workshop_submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   UUID NOT NULL REFERENCES workshops(workshop_id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  author_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          JSONB NOT NULL DEFAULT '{}',
  grade         NUMERIC(5,2),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workshop_subs_workshop ON workshop_submissions(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_subs_author   ON workshop_submissions(author_id);
CREATE INDEX IF NOT EXISTS idx_workshop_subs_tenant   ON workshop_submissions(tenant_id);

CREATE TABLE IF NOT EXISTS workshop_assessments (
  assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   UUID NOT NULL REFERENCES workshops(workshop_id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES workshop_submissions(submission_id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  assessor_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  grades        JSONB NOT NULL DEFAULT '{}',
  feedback      TEXT,
  grade         NUMERIC(5,2),
  submitted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id, assessor_id)
);

CREATE INDEX IF NOT EXISTS idx_workshop_assess_workshop    ON workshop_assessments(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_assess_submission  ON workshop_assessments(submission_id);
CREATE INDEX IF NOT EXISTS idx_workshop_assess_assessor    ON workshop_assessments(assessor_id);
CREATE INDEX IF NOT EXISTS idx_workshop_assess_tenant      ON workshop_assessments(tenant_id);

-- ─── Wikis ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wikis (
  wiki_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL,
  wiki_type  TEXT NOT NULL DEFAULT 'collaborative' CHECK(wiki_type IN ('individual','collaborative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id)
);

CREATE INDEX IF NOT EXISTS idx_wikis_tenant ON wikis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wikis_module ON wikis(module_id);

CREATE TABLE IF NOT EXISTS wiki_pages (
  page_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_id    UUID NOT NULL REFERENCES wikis(wiki_id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL,
  owner_id   UUID REFERENCES users(user_id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  body       JSONB NOT NULL DEFAULT '{}',
  version    INT NOT NULL DEFAULT 1,
  locked     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_wiki   ON wiki_pages(wiki_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_owner  ON wiki_pages(owner_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_tenant ON wiki_pages(tenant_id);

CREATE TABLE IF NOT EXISTS wiki_page_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id    UUID NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL,
  version    INT NOT NULL,
  body       JSONB NOT NULL DEFAULT '{}',
  edited_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wiki_versions_page   ON wiki_page_versions(page_id);
CREATE INDEX IF NOT EXISTS idx_wiki_versions_tenant ON wiki_page_versions(tenant_id);

-- ─── Attendance ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_sessions (
  session_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id         UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL,
  calendar_event_id UUID REFERENCES calendar_events(event_id) ON DELETE SET NULL,
  session_date      DATE NOT NULL,
  description       TEXT,
  created_by        UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_module  ON attendance_sessions(module_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_tenant  ON attendance_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date    ON attendance_sessions(module_id, session_date);

CREATE TABLE IF NOT EXISTS attendance_records (
  record_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES attendance_sessions(session_id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'absent' CHECK(status IN ('present','late','absent','excused')),
  recorded_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user    ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant  ON attendance_records(tenant_id);
