-- Phase 3: Communication, Collaboration & Realtime
-- Adds announcements, presence sessions, forum read tracking, and message read receipts

-- Announcements (course, cohort, system)
CREATE TABLE IF NOT EXISTS announcements (
  announcement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(course_id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES cohorts(cohort_id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(user_id),
  title TEXT NOT NULL,
  body JSONB NOT NULL,
  channel TEXT NOT NULL DEFAULT 'course', -- course|cohort|system
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_course ON announcements(course_id);
CREATE INDEX IF NOT EXISTS idx_announcements_tenant ON announcements(tenant_id);

-- Presence sessions (online/offline/idle per user)
CREATE TABLE IF NOT EXISTS presence_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'online', -- online|idle|offline
  context_type TEXT, -- course|forum|message
  context_id UUID,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '5 minutes',
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_presence_user ON presence_sessions(user_id);

-- Forum thread read status (per user, per thread)
CREATE TABLE IF NOT EXISTS forum_read_status (
  thread_id UUID NOT NULL REFERENCES forum_threads(thread_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

-- Forum thread subscriptions (to drive notifications)
CREATE TABLE IF NOT EXISTS forum_subscriptions (
  forum_id UUID NOT NULL REFERENCES forums(forum_id) ON DELETE CASCADE,
  thread_id UUID REFERENCES forum_threads(thread_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (forum_id, user_id)
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS message_read_receipts (
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES messages(message_id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Add pinned column to forum threads if not already present
ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Add forum_type to forums (announcement|general|group|module)
ALTER TABLE forums ADD COLUMN IF NOT EXISTS forum_type TEXT NOT NULL DEFAULT 'general';

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_forum_subscriptions_user ON forum_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_convo ON message_read_receipts(conversation_id);
