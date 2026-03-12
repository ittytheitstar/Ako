-- Seed baseline permissions and roles
INSERT INTO tenants (tenant_id, name, slug) VALUES
  (gen_random_uuid(), 'Ako Demo Tenant', 'demo')
ON CONFLICT DO NOTHING;

-- permissions
INSERT INTO permissions (name, description) VALUES
  ('tenant:admin', 'Full tenant administration'),
  ('course:create', 'Create courses'),
  ('course:edit', 'Edit courses and modules'),
  ('course:view', 'View courses'),
  ('enrol:manage', 'Manage enrolments and cohorts'),
  ('assessment:create', 'Create assignments and quizzes'),
  ('assessment:grade', 'Grade submissions and attempts'),
  ('grade:view', 'View gradebook'),
  ('forum:moderate', 'Moderate forums'),
  ('message:send', 'Send messages'),
  ('reaction:use', 'Use reactions')
ON CONFLICT (name) DO NOTHING;
