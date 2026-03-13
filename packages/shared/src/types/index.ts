export interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  settings: Record<string, unknown>;
}

export interface User {
  user_id: string;
  tenant_id: string;
  username: string;
  email: string;
  display_name: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  timezone?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Role {
  role_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  system_role: boolean;
  created_at: string;
}

export interface Permission {
  permission_id: string;
  name: string;
  description?: string;
}

export interface Course {
  course_id: string;
  tenant_id: string;
  course_code: string;
  title: string;
  description?: string;
  visibility: 'private' | 'tenant' | 'public';
  status: 'draft' | 'published' | 'completed' | 'archived' | 'deleted';
  published_at?: string;
  term_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  policy_id?: string;
  retention_until?: string;
  legal_hold: boolean;
}

export interface CourseSection {
  section_id: string;
  tenant_id: string;
  course_id: string;
  title: string;
  position: number;
  summary?: string;
  created_at: string;
}

export interface CourseModule {
  module_id: string;
  tenant_id: string;
  course_id: string;
  section_id?: string;
  module_type: 'page' | 'file' | 'forum' | 'assignment' | 'quiz' | 'lti' | 'scorm';
  title: string;
  settings: Record<string, unknown>;
  availability: Record<string, unknown>;
  created_at: string;
}

export interface Enrolment {
  enrolment_id: string;
  tenant_id: string;
  course_id: string;
  user_id: string;
  role: 'student' | 'teacher' | 'ta' | 'observer';
  status: 'active' | 'suspended' | 'completed';
  cohort_id?: string;
  group_id?: string;
  start_at?: string;
  end_at?: string;
  created_at: string;
}

export interface Cohort {
  cohort_id: string;
  tenant_id: string;
  code: string;
  name: string;
  created_at: string;
}

export interface Forum {
  forum_id: string;
  tenant_id: string;
  course_id: string;
  title: string;
  settings: Record<string, unknown>;
}

export interface ForumThread {
  thread_id: string;
  tenant_id: string;
  forum_id: string;
  title: string;
  created_by: string;
  created_at: string;
  locked: boolean;
}

export interface ForumPost {
  post_id: string;
  tenant_id: string;
  thread_id: string;
  parent_post_id?: string;
  author_id: string;
  body: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface Assignment {
  assignment_id: string;
  tenant_id: string;
  module_id: string;
  due_at?: string;
  max_grade: number;
  rubric: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface AssignmentSubmission {
  submission_id: string;
  tenant_id: string;
  assignment_id: string;
  user_id: string;
  submitted_at?: string;
  status: 'draft' | 'submitted' | 'late';
  body: Record<string, unknown>;
  file_ids: string[];
}

export interface GradeItem {
  item_id: string;
  tenant_id: string;
  course_id: string;
  source_type: 'assignment' | 'quiz' | 'manual' | 'lti';
  source_id?: string;
  name: string;
  max_grade: number;
  settings: Record<string, unknown>;
}

export interface Grade {
  grade_id: string;
  tenant_id: string;
  item_id: string;
  user_id: string;
  grade?: number;
  feedback?: string;
  graded_at?: string;
  graded_by?: string;
  overridden: boolean;
  locked: boolean;
}

export interface Message {
  message_id: string;
  tenant_id: string;
  conversation_id: string;
  author_id: string;
  body: Record<string, unknown>;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
}

export interface Notification {
  notification_id: string;
  tenant_id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export interface AuditLog {
  audit_id: string;
  tenant_id: string;
  actor_id?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  ip?: string;
  user_agent?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  total?: number;
}

export interface TokenPayload {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface Announcement {
  announcement_id: string;
  tenant_id: string;
  course_id?: string;
  cohort_id?: string;
  author_id: string;
  title: string;
  body: Record<string, unknown>;
  channel: 'course' | 'cohort' | 'system';
  scheduled_at?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PresenceSession {
  session_id: string;
  tenant_id: string;
  user_id: string;
  status: 'online' | 'idle' | 'offline';
  context_type?: string;
  context_id?: string;
  last_seen_at: string;
  expires_at: string;
}

export interface Conversation {
  conversation_id: string;
  tenant_id: string;
  convo_type: 'dm' | 'cohort' | 'course' | 'support';
  course_id?: string;
  cohort_id?: string;
  created_at: string;
  message_count?: number;
  last_message_at?: string;
  last_read_at?: string;
  members?: Array<{ user_id: string; role: string }>;
}

export interface ForumSubscription {
  forum_id: string;
  thread_id?: string;
  user_id: string;
  created_at: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export interface Term {
  term_id: string;
  tenant_id: string;
  name: string;
  code: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
}

export interface CourseGroup {
  group_id: string;
  tenant_id: string;
  course_id: string;
  cohort_id?: string;
  name: string;
  created_at: string;
}

export interface CourseGrouping {
  grouping_id: string;
  tenant_id: string;
  course_id: string;
  name: string;
  created_at: string;
}

export interface EnrolmentMethod {
  method_id: string;
  tenant_id: string;
  course_id: string;
  method_type: 'manual' | 'cohort_sync';
  cohort_id?: string;
  default_role: string;
  create_group: boolean;
  active: boolean;
  created_at: string;
}
export interface RetentionPolicy {
  policy_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  course_type?: string;
  programme?: string;
  regulatory_requirement?: string;
  retention_months: number;
  access_level: 'read_only' | 'restricted' | 'none';
  disposal_action: 'archive' | 'delete' | 'export';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CourseArchive {
  archive_id: string;
  tenant_id: string;
  course_id: string;
  archived_by?: string;
  archived_at: string;
  restored_at?: string;
  restored_by?: string;
  trigger_type: 'manual' | 'scheduled' | 'cohort_end' | 'course_end';
  snapshot: Record<string, unknown>;
  integrity_hash?: string;
  immutable: boolean;
  notes?: string;
}

export interface AnalyticsSnapshot {
  snapshot_id: string;
  tenant_id: string;
  course_id?: string;
  cohort_id?: string;
  snapshot_type: 'enrolments' | 'activity' | 'forum_engagement' | 'completion';
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  generated_at: string;
}

export interface ExportJob {
  export_id: string;
  tenant_id: string;
  course_id?: string;
  requested_by: string;
  export_type: 'course_archive' | 'assessment_evidence' | 'engagement_metrics';
  status: 'pending' | 'running' | 'completed' | 'failed';
  file_key?: string;
  file_size_bytes?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface AuditEvent {
  event_id: string;
  tenant_id: string;
  actor_id?: string;
  event_type: string;
  resource_type?: string;
  resource_id?: string;
  ip?: string;
  user_agent?: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface EnrolmentReport {
  course_id: string;
  course_code: string;
  title: string;
  total_enrolments: number;
  active_enrolments: number;
  completed_enrolments: number;
  suspended_enrolments: number;
}

export interface ActivityReport {
  course_id: string;
  course_code: string;
  title: string;
  total_posts: number;
  total_submissions: number;
  active_learners: number;
}

export interface CompletionReport {
  course_id: string;
  course_code: string;
  title: string;
  total_enrolments: number;
  completed_count: number;
  completion_rate: number;
}

// ── Phase 5 Types ─────────────────────────────────────────────────────────────

export interface Plugin {
  plugin_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  plugin_type: 'ui' | 'backend' | 'automation';
  api_version: string;
  permission_scopes: string[];
  author?: string;
  homepage_url?: string;
  status: 'disabled' | 'enabled' | 'error';
  enabled_contexts: unknown[];
  resource_limits: Record<string, unknown>;
  installed_by?: string;
  installed_at: string;
  updated_at: string;
}

export interface PluginVersion {
  version_id: string;
  plugin_id: string;
  version: string;
  changelog?: string;
  bundle_url?: string;
  bundle_hash?: string;
  is_current: boolean;
  published_at: string;
}

export interface Webhook {
  webhook_id: string;
  tenant_id: string;
  name: string;
  target_url: string;
  event_types: string[];
  active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_fired_at?: string;
  failure_count: number;
}

export interface WebhookDelivery {
  delivery_id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'failed';
  http_status?: number;
  response_body?: string;
  attempt: number;
  fired_at: string;
  next_retry_at?: string;
}

export interface IntegrationConnector {
  connector_id: string;
  tenant_id: string;
  name: string;
  connector_type: 'sis' | 'sms' | 'identity' | 'assessment' | 'content' | 'analytics';
  settings: Record<string, unknown>;
  status: 'connected' | 'disconnected' | 'error';
  health_status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  last_health_check?: string;
  latency_ms?: number;
  error_message?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  rule_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  trigger_event: string;
  conditions: unknown[];
  actions: unknown[];
  active: boolean;
  last_triggered_at?: string;
  trigger_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  log_id: string;
  rule_id: string;
  tenant_id: string;
  trigger_event: string;
  trigger_payload: Record<string, unknown>;
  actions_taken: unknown[];
  outcome: 'success' | 'skipped' | 'error';
  error_message?: string;
  created_at: string;
}

export interface FeatureFlag {
  flag_id: string;
  tenant_id?: string;
  name: string;
  description?: string;
  enabled: boolean;
  rollout_pct: number;
  context: 'global' | 'tenant' | 'course';
  metadata: Record<string, unknown>;
  changed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DeveloperApiKey {
  key_id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  active: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

// ── Phase 6 Types ─────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  config_id: string;
  tenant_id?: string;
  route_pattern?: string;
  window_seconds: number;
  max_requests: number;
  max_write_requests?: number;
  burst_multiplier: number;
  scope: 'global' | 'tenant' | 'api_key';
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PermissionAuditLog {
  audit_id: string;
  tenant_id: string;
  actor_id?: string;
  permission_name: string;
  resource_type?: string;
  resource_id?: string;
  granted: boolean;
  denial_reason?: string;
  ip?: string;
  user_agent?: string;
  checked_at: string;
}

export interface MetricSnapshot {
  snapshot_id: string;
  tenant_id?: string;
  metric_name: string;
  value: number;
  labels: Record<string, unknown>;
  period_start: string;
  period_end: string;
  recorded_at: string;
}

export interface MetricsSummary {
  http: {
    requests_total: number;
    errors_total: number;
    error_rate_pct: number;
    latency_ms: { p50: number; p95: number; p99: number };
  };
  database: {
    pool_active_connections: number;
    ping_ms: number;
  };
  process: {
    uptime_seconds: number;
    memory_mb: number;
  };
  collected_at: string;
}

export interface SystemAlert {
  alert_id: string;
  tenant_id?: string;
  name: string;
  description?: string;
  metric_name: string;
  threshold_value: number;
  comparison: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  window_seconds: number;
  severity: 'info' | 'warning' | 'critical';
  active: boolean;
  notify_channels: string[];
  last_evaluated_at?: string;
  last_triggered_at?: string;
  trigger_count: number;
  resolved_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SystemAlertEvent {
  event_id: string;
  alert_id: string;
  tenant_id?: string;
  metric_value: number;
  threshold_value: number;
  severity: string;
  status: 'triggered' | 'resolved';
  message?: string;
  triggered_at: string;
  resolved_at?: string;
  alert_name?: string;
  metric_name?: string;
}

export interface PermissionMatrix {
  roles: Array<{
    role_id: string;
    role_name: string;
    permissions: string[];
  }>;
  permissions: Array<{
    permission_id: string;
    name: string;
    description?: string;
  }>;
}

// ── Phase 8 Types ─────────────────────────────────────────────────────────────

export type CompletionType = 'view' | 'submit' | 'grade' | 'post' | 'manual' | 'teacher';
export type CompletionState = 'incomplete' | 'complete' | 'complete_pass' | 'complete_fail';
export type CourseCompletionState = 'incomplete' | 'in_progress' | 'complete';
export type CompletionCriterionType = 'required_modules' | 'min_grade' | 'required_date' | 'all_modules';

export interface ActivityCompletionRule {
  rule_id: string;
  tenant_id: string;
  module_id: string;
  completion_type: CompletionType;
  passing_grade?: number;
  require_view: boolean;
  expected_completion_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityCompletionState {
  state_id: string;
  tenant_id: string;
  module_id: string;
  user_id: string;
  state: CompletionState;
  completed_at?: string;
  completion_source?: CompletionType;
  overridden_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CourseCompletionCriterion {
  criterion_id: string;
  tenant_id: string;
  course_id: string;
  criterion_type: CompletionCriterionType;
  settings: Record<string, unknown>;
  created_by?: string;
  created_at: string;
}

export interface CourseCompletionStateRecord {
  ccs_id: string;
  tenant_id: string;
  course_id: string;
  user_id: string;
  state: CourseCompletionState;
  progress_pct: number;
  completed_at?: string;
  last_evaluated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CourseProgressSummary {
  course_id: string;
  user_id: string;
  state: CourseCompletionState;
  progress_pct: number;
  total_tracked: number;
  complete_count: number;
  incomplete_count: number;
  complete_pass_count: number;
  complete_fail_count: number;
  completed_at?: string;
  last_evaluated_at?: string;
  next_action?: string;
}

export interface LearnerProgressRow {
  user_id: string;
  display_name: string;
  email: string;
  state: CourseCompletionState;
  progress_pct: number;
  completed_at?: string;
  last_evaluated_at?: string;
}
