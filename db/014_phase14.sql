-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 14 – Kanban Boards, Issue Tracker & User Stories
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── kanban_board_templates ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kanban_board_templates (
  template_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  description      TEXT,
  lane_definitions JSONB       NOT NULL DEFAULT '[]',
  seed_cards       JSONB       NOT NULL DEFAULT '[]',
  created_by       UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kbt_tenant ON kanban_board_templates(tenant_id);

-- ─── kanban_boards ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kanban_boards (
  board_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id        UUID        NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  cohort_id        UUID        REFERENCES cohorts(cohort_id) ON DELETE SET NULL,
  owner_user_id    UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  title            TEXT        NOT NULL,
  description      TEXT,
  template_id      UUID        REFERENCES kanban_board_templates(template_id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK(status IN ('active','archived')),
  settings         JSONB       NOT NULL DEFAULT '{}',
  created_by       UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kb_tenant    ON kanban_boards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_course    ON kanban_boards(course_id);
CREATE INDEX IF NOT EXISTS idx_kb_owner     ON kanban_boards(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_kb_status    ON kanban_boards(status);

-- ─── kanban_lanes ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kanban_lanes (
  lane_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      UUID        NOT NULL REFERENCES kanban_boards(board_id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  position      INT         NOT NULL DEFAULT 0,
  color         TEXT        NOT NULL DEFAULT '#6366f1',
  wip_limit     INT         NOT NULL DEFAULT 0,
  is_done_lane  BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kl_board  ON kanban_lanes(board_id);
CREATE INDEX IF NOT EXISTS idx_kl_tenant ON kanban_lanes(tenant_id);

-- ─── kanban_cards ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kanban_cards (
  card_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id             UUID        NOT NULL REFERENCES kanban_boards(board_id) ON DELETE CASCADE,
  lane_id              UUID        NOT NULL REFERENCES kanban_lanes(lane_id) ON DELETE CASCADE,
  tenant_id            UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title                TEXT        NOT NULL,
  description          TEXT,
  assignees            UUID[]      NOT NULL DEFAULT '{}',
  start_date           DATE,
  end_date             DATE,
  time_worked_minutes  INT         NOT NULL DEFAULT 0,
  tags                 TEXT[]      NOT NULL DEFAULT '{}',
  flags                TEXT[]      NOT NULL DEFAULT '{}',
  position             INT         NOT NULL DEFAULT 0,
  priority             TEXT        NOT NULL DEFAULT 'medium'
                                   CHECK(priority IN ('low','medium','high','critical')),
  story_points         INT,
  issue_id             UUID,
  user_story_id        UUID,
  archived             BOOLEAN     NOT NULL DEFAULT false,
  created_by           UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kc_board    ON kanban_cards(board_id);
CREATE INDEX IF NOT EXISTS idx_kc_lane     ON kanban_cards(lane_id);
CREATE INDEX IF NOT EXISTS idx_kc_tenant   ON kanban_cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kc_archived ON kanban_cards(archived);

-- ─── kanban_card_time_logs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kanban_card_time_logs (
  time_log_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID        NOT NULL REFERENCES kanban_cards(card_id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  minutes     INT         NOT NULL CHECK(minutes > 0),
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_kctl_card   ON kanban_card_time_logs(card_id);
CREATE INDEX IF NOT EXISTS idx_kctl_user   ON kanban_card_time_logs(user_id);

-- ─── kanban_board_members ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kanban_board_members (
  member_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID        NOT NULL REFERENCES kanban_boards(board_id) ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  board_role TEXT        NOT NULL DEFAULT 'contributor'
                         CHECK(board_role IN ('viewer','contributor','member','manager','admin')),
  added_by   UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kbm_board  ON kanban_board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_kbm_user   ON kanban_board_members(user_id);

-- ─── user_stories ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_stories (
  story_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id            UUID        NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  title                TEXT        NOT NULL,
  as_a                 TEXT,
  i_want               TEXT,
  so_that              TEXT,
  acceptance_criteria  TEXT,
  priority             TEXT        NOT NULL DEFAULT 'medium'
                                   CHECK(priority IN ('low','medium','high','critical')),
  status               TEXT        NOT NULL DEFAULT 'draft'
                                   CHECK(status IN ('draft','ready','in_progress','done','rejected')),
  story_points         INT,
  assignees            UUID[]      NOT NULL DEFAULT '{}',
  labels               TEXT[]      NOT NULL DEFAULT '{}',
  competency_id        UUID        REFERENCES competencies(competency_id) ON DELETE SET NULL,
  created_by           UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_us_tenant  ON user_stories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_us_course  ON user_stories(course_id);
CREATE INDEX IF NOT EXISTS idx_us_status  ON user_stories(status);

-- ─── issues ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS issues (
  issue_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id      UUID        NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  board_id       UUID        REFERENCES kanban_boards(board_id) ON DELETE SET NULL,
  user_story_id  UUID        REFERENCES user_stories(story_id) ON DELETE SET NULL,
  title          TEXT        NOT NULL,
  description    TEXT,
  type           TEXT        NOT NULL DEFAULT 'task'
                             CHECK(type IN ('bug','feature','improvement','task','question')),
  status         TEXT        NOT NULL DEFAULT 'open'
                             CHECK(status IN ('open','in_progress','resolved','closed','wont_fix')),
  priority       TEXT        NOT NULL DEFAULT 'medium'
                             CHECK(priority IN ('low','medium','high','critical')),
  reporter_id    UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  assignees      UUID[]      NOT NULL DEFAULT '{}',
  labels         TEXT[]      NOT NULL DEFAULT '{}',
  due_date       DATE,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iss_tenant  ON issues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_iss_course  ON issues(course_id);
CREATE INDEX IF NOT EXISTS idx_iss_status  ON issues(status);
CREATE INDEX IF NOT EXISTS idx_iss_board   ON issues(board_id);
CREATE INDEX IF NOT EXISTS idx_iss_story   ON issues(user_story_id);

-- ─── issue_comments ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS issue_comments (
  comment_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id   UUID        NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_issue  ON issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_ic_user   ON issue_comments(user_id);

-- Add foreign key constraints for cards referencing issues and user_stories
-- (deferred because those tables are created after kanban_cards)
ALTER TABLE kanban_cards
  ADD CONSTRAINT fk_kc_issue        FOREIGN KEY (issue_id)       REFERENCES issues(issue_id)       ON DELETE SET NULL,
  ADD CONSTRAINT fk_kc_user_story   FOREIGN KEY (user_story_id)  REFERENCES user_stories(story_id) ON DELETE SET NULL;
