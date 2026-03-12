-- Ako LMS (PostgreSQL) - initial schema
-- Generated scaffold. Use pgcrypto for gen_random_uuid().

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tenancy
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Identity
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  given_name TEXT,
  family_name TEXT,
  locale TEXT,
  timezone TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_users_tenant_username UNIQUE (tenant_id, username),
  CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS user_identities (
  identity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- oidc|saml|local|lti|scim
  subject TEXT NOT NULL,  -- sub / NameID / externalId
  claims JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, subject)
);

-- RBAC
CREATE TABLE IF NOT EXISTS roles (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
  permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g. course:edit, grade:view
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'tenant', -- tenant|course|group
  scope_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, role_id, scope_type, scope_id)
);

-- Cohorts and Courses
CREATE TABLE IF NOT EXISTS cohorts (
  cohort_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS cohort_members (
  cohort_id UUID NOT NULL REFERENCES cohorts(cohort_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, user_id)
);

CREATE TABLE IF NOT EXISTS courses (
  course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private', -- private|tenant|public
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  UNIQUE (tenant_id, course_code)
);

CREATE TABLE IF NOT EXISTS enrolments (
  enrolment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student', -- student|teacher|ta|observer
  status TEXT NOT NULL DEFAULT 'active', -- active|suspended|completed
  cohort_id UUID REFERENCES cohorts(cohort_id),
  group_id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, course_id, user_id)
);

CREATE TABLE IF NOT EXISTS course_sections (
  section_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INT NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, position)
);

CREATE TABLE IF NOT EXISTS course_modules (
  module_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  section_id UUID REFERENCES course_sections(section_id) ON DELETE SET NULL,
  module_type TEXT NOT NULL, -- page|file|forum|assignment|quiz|lti|scorm
  title TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  availability JSONB NOT NULL DEFAULT '{}'::jsonb, -- groups/cohorts/conditions
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content items (pages, resources, etc.)
CREATE TABLE IF NOT EXISTS content_items (
  content_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- html|markdown|embed|scorm
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assignments
CREATE TABLE IF NOT EXISTS assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ,
  max_grade NUMERIC(10,2) NOT NULL DEFAULT 100,
  rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(assignment_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|submitted|late
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_ids UUID[] NOT NULL DEFAULT '{}',
  UNIQUE (assignment_id, user_id)
);

CREATE TABLE IF NOT EXISTS assignment_feedback (
  feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES assignment_submissions(submission_id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(user_id),
  grade NUMERIC(10,2),
  comments TEXT,
  inline_comments JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quiz engine (simplified)
CREATE TABLE IF NOT EXISTS quizzes (
  quiz_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES course_modules(module_id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_limit_seconds INT,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  qtype TEXT NOT NULL, -- mcq|multi|short|essay|match|truefalse
  prompt JSONB NOT NULL,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  answer_key JSONB NOT NULL DEFAULT '{}'::jsonb,
  points NUMERIC(10,2) NOT NULL DEFAULT 1,
  position INT NOT NULL,
  UNIQUE (quiz_id, position)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress|submitted|graded
  score NUMERIC(10,2),
  UNIQUE (quiz_id, user_id, started_at)
);

CREATE TABLE IF NOT EXISTS quiz_answers (
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(attempt_id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(question_id) ON DELETE CASCADE,
  response JSONB NOT NULL,
  score NUMERIC(10,2),
  PRIMARY KEY (attempt_id, question_id)
);

-- Gradebook
CREATE TABLE IF NOT EXISTS grade_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- assignment|quiz|manual|lti
  source_id UUID,
  name TEXT NOT NULL,
  max_grade NUMERIC(10,2) NOT NULL DEFAULT 100,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS grades (
  grade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES grade_items(item_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  grade NUMERIC(10,2),
  feedback TEXT,
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES users(user_id),
  overridden BOOLEAN NOT NULL DEFAULT FALSE,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (item_id, user_id)
);

-- Forums + reactions (cohort-scoped)
CREATE TABLE IF NOT EXISTS forums (
  forum_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS forum_threads (
  thread_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  forum_id UUID NOT NULL REFERENCES forums(forum_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS forum_posts (
  post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES forum_threads(thread_id) ON DELETE CASCADE,
  parent_post_id UUID REFERENCES forum_posts(post_id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES users(user_id),
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id UUID NOT NULL REFERENCES forum_posts(post_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reaction TEXT NOT NULL, -- like|love|laugh|wow|sad|angry|custom
  visibility TEXT NOT NULL DEFAULT 'cohort', -- cohort|dm|public
  scope_id UUID, -- cohort_id or conversation_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, reaction, visibility, scope_id)
);

-- Messaging (1:1 and cohort)
CREATE TABLE IF NOT EXISTS conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  convo_type TEXT NOT NULL, -- dm|cohort|course|support
  course_id UUID REFERENCES courses(course_id),
  cohort_id UUID REFERENCES cohorts(cohort_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(user_id),
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id UUID NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'dm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, reaction)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Files
CREATE TABLE IF NOT EXISTS files (
  file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(user_id),
  storage_provider TEXT NOT NULL DEFAULT 's3',
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_refs (
  ref_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
  ref_type TEXT NOT NULL, -- submission|content|message|feedback
  ref_id_target UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LTI 1.3 (registration & deployment simplified)
CREATE TABLE IF NOT EXISTS lti_registrations (
  registration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  auth_login_url TEXT NOT NULL,
  auth_token_url TEXT NOT NULL,
  keyset_url TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, issuer, client_id)
);

CREATE TABLE IF NOT EXISTS lti_deployments (
  deployment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES lti_registrations(registration_id) ON DELETE CASCADE,
  platform_deployment_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, registration_id, platform_deployment_id)
);

CREATE TABLE IF NOT EXISTS lti_resource_links (
  resource_link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  deployment_id UUID NOT NULL REFERENCES lti_deployments(deployment_id) ON DELETE CASCADE,
  context_id UUID, -- course_id
  tool_url TEXT NOT NULL,
  title TEXT,
  custom JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SCIM bookkeeping
CREATE TABLE IF NOT EXISTS scim_resources (
  scim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- User|Group
  resource_id UUID NOT NULL,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, resource_type, resource_id)
);

CREATE TABLE IF NOT EXISTS scim_etags (
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  etag TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, resource_type, resource_id)
);

-- Outbox + audit
CREATE TABLE IF NOT EXISTS outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  key TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(user_id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  ip INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhooks (
  webhook_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  webhook_id UUID NOT NULL REFERENCES webhooks(webhook_id) ON DELETE CASCADE,
  event_id UUID REFERENCES outbox_events(event_id) ON DELETE SET NULL,
  status_code INT,
  response_body TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT FALSE
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant ON courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_course ON enrolments(course_id);
CREATE INDEX IF NOT EXISTS idx_posts_thread ON forum_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversation_id);
