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
  // Phase 12 – template fields
  is_template?: boolean;
  template_category?: string;
  template_tags?: string[];
  template_description?: string;
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

export type GradeType = 'numerical' | 'scale' | 'letter' | 'pass_fail';

export interface GradeItem {
  item_id: string;
  tenant_id: string;
  course_id: string;
  source_type: 'assignment' | 'quiz' | 'manual' | 'lti';
  source_id?: string;
  name: string;
  max_grade: number;
  settings: Record<string, unknown>;
  // Phase 9 enhancements
  category_id?: string;
  weight: number;
  extra_credit: boolean;
  hidden: boolean;
  locked: boolean;
  release_at?: string;
  grade_type: GradeType;
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

// ── Phase 9 Types ─────────────────────────────────────────────────────────────

export type QuestionStatus = 'draft' | 'published' | 'deprecated';
export type QuestionType = 'mcq' | 'multi' | 'short' | 'essay' | 'match' | 'truefalse';
export type GradingStrategy = 'highest' | 'average' | 'latest' | 'first';
export type BehaviourMode = 'deferred_feedback' | 'interactive' | 'immediate_feedback';
export type AggregationStrategy = 'weighted_mean' | 'simple_mean' | 'sum' | 'highest' | 'lowest' | 'mode';
export type MarkingWorkflowState = 'unmarked' | 'in_progress' | 'ready_for_release' | 'released';
export type PoolOrder = 'random' | 'fixed';

export interface QuestionCategory {
  category_id: string;
  tenant_id: string;
  course_id?: string;
  parent_id?: string;
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Question {
  question_id: string;
  tenant_id: string;
  course_id?: string;
  category_id?: string;
  qtype: QuestionType;
  status: QuestionStatus;
  tags: string[];
  created_by?: string;
  shared_at?: string;
  shared_by?: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionVersion {
  version_id: string;
  question_id: string;
  version_num: number;
  prompt: Record<string, unknown>;
  options: Record<string, unknown>;
  answer_key: Record<string, unknown>;
  points: number;
  created_by?: string;
  created_at: string;
}

export interface QuestionWithLatestVersion extends Question {
  latest_version?: QuestionVersion;
  versions?: QuestionVersion[];
}

export interface QuizQuestionPool {
  pool_id: string;
  quiz_id: string;
  tenant_id: string;
  source_category_id?: string;
  pick_count: number;
  pool_order: PoolOrder;
  position: number;
  created_at: string;
}

export interface GradeCategory {
  category_id: string;
  tenant_id: string;
  course_id: string;
  parent_id?: string;
  name: string;
  aggregation_strategy: AggregationStrategy;
  drop_lowest: number;
  weight: number;
  created_at: string;
  updated_at: string;
}

export interface GradeScale {
  scale_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  levels?: GradeScaleLevel[];
}

export interface GradeScaleLevel {
  level_id: string;
  scale_id: string;
  name: string;
  value: number;
  created_at: string;
}

export interface MarkingWorkflowStateRecord {
  mws_id: string;
  tenant_id: string;
  item_id: string;
  user_id: string;
  state: MarkingWorkflowState;
  marker_id?: string;
  moderator_id?: string;
  notes?: string;
  updated_at: string;
  created_at: string;
}

// ── Phase 10 Types ────────────────────────────────────────────────────────────

export type CalendarContextType = 'course' | 'cohort' | 'system';
export type CalendarSourceType = 'assignment' | 'quiz' | 'announcement' | 'term' | 'manual';
export type CalendarVisibility = 'public' | 'grouping' | 'private';

export interface CalendarEvent {
  event_id: string;
  tenant_id: string;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  all_day: boolean;
  recurrence_rule?: string;
  recurrence_exceptions: string[];
  context_type: CalendarContextType;
  context_id?: string;
  source_type: CalendarSourceType;
  source_id?: string;
  visibility: CalendarVisibility;
  grouping_id?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarReminderPref {
  pref_id: string;
  tenant_id: string;
  user_id: string;
  event_type: string;
  enabled: boolean;
  intervals: number[];
  created_at: string;
  updated_at: string;
}

export interface ExternalCalendarSource {
  source_id: string;
  tenant_id: string;
  name: string;
  url: string;
  sync_interval_minutes: number;
  last_synced_at?: string;
  active: boolean;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalCalendarEvent {
  ext_event_id: string;
  tenant_id: string;
  source_id: string;
  source_name?: string;
  uid: string;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  all_day: boolean;
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IcalTokenResponse {
  token: string;
  url: string;
}

// ── Phase 11 Types ────────────────────────────────────────────────────────────

export type LessonPageType = 'content' | 'question' | 'end_of_lesson' | 'branch_table';

export interface Lesson {
  lesson_id: string;
  module_id: string;
  tenant_id: string;
  time_limit_minutes?: number;
  max_attempts: number;
  passing_grade: number;
  created_at: string;
  updated_at: string;
}

export interface LessonPage {
  page_id: string;
  lesson_id: string;
  tenant_id: string;
  page_type: LessonPageType;
  title: string;
  body: Record<string, unknown>;
  question: Record<string, unknown>;
  jump_target: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface LessonAttempt {
  attempt_id: string;
  lesson_id: string;
  tenant_id: string;
  user_id: string;
  current_page_id?: string;
  score?: number;
  started_at: string;
  completed_at?: string;
}

export interface LessonAttemptAnswer {
  answer_id: string;
  attempt_id: string;
  page_id: string;
  answer: Record<string, unknown>;
  correct?: boolean;
  created_at: string;
}

export type ChoiceShowResults = 'after_answer' | 'after_close' | 'never';

export interface Choice {
  choice_id: string;
  module_id: string;
  tenant_id: string;
  question: string;
  close_at?: string;
  allow_update: boolean;
  show_results: ChoiceShowResults;
  multiple_select: boolean;
  anonymous: boolean;
  created_at: string;
  updated_at: string;
  options?: ChoiceOption[];
}

export interface ChoiceOption {
  option_id: string;
  choice_id: string;
  tenant_id: string;
  text: string;
  max_answers?: number;
  position: number;
  created_at: string;
  answer_count?: number;
}

export interface ChoiceAnswer {
  answer_id: string;
  choice_id: string;
  tenant_id: string;
  user_id: string;
  option_ids: string[];
  created_at: string;
  updated_at: string;
}

export type GlossaryEntryStatus = 'pending' | 'approved' | 'rejected';

export interface GlossaryCategory {
  category_id: string;
  module_id: string;
  tenant_id: string;
  name: string;
  created_at: string;
}

export interface GlossaryEntry {
  entry_id: string;
  module_id: string;
  tenant_id: string;
  term: string;
  definition: string;
  author_id?: string;
  author_name?: string;
  category_id?: string;
  category_name?: string;
  status: GlossaryEntryStatus;
  created_at: string;
  updated_at: string;
}

export type WorkshopPhase = 'setup' | 'submission' | 'assessment' | 'grading' | 'closed';
export type WorkshopAllocationStrategy = 'random' | 'manual';

export interface Workshop {
  workshop_id: string;
  module_id: string;
  tenant_id: string;
  phase: WorkshopPhase;
  submission_end_at?: string;
  assessment_end_at?: string;
  peer_count: number;
  submission_weight: number;
  assessment_weight: number;
  self_assessment: boolean;
  allocation_strategy: WorkshopAllocationStrategy;
  created_at: string;
  updated_at: string;
}

export interface WorkshopSubmission {
  submission_id: string;
  workshop_id: string;
  tenant_id: string;
  author_id: string;
  author_name?: string;
  title: string;
  body: Record<string, unknown>;
  grade?: number;
  submitted_at: string;
  updated_at: string;
}

export interface WorkshopAssessment {
  assessment_id: string;
  workshop_id: string;
  submission_id: string;
  tenant_id: string;
  assessor_id: string;
  assessor_name?: string;
  grades: Record<string, unknown>;
  feedback?: string;
  grade?: number;
  submitted_at?: string;
  created_at: string;
}

export type WikiType = 'individual' | 'collaborative';

export interface Wiki {
  wiki_id: string;
  module_id: string;
  tenant_id: string;
  wiki_type: WikiType;
  created_at: string;
  updated_at: string;
}

export interface WikiPage {
  page_id: string;
  wiki_id: string;
  tenant_id: string;
  owner_id?: string;
  owner_name?: string;
  title: string;
  body: Record<string, unknown>;
  version: number;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface WikiPageVersion {
  version_id: string;
  page_id: string;
  tenant_id: string;
  version: number;
  body: Record<string, unknown>;
  edited_by?: string;
  editor_name?: string;
  created_at: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface AttendanceSession {
  session_id: string;
  module_id: string;
  tenant_id: string;
  calendar_event_id?: string;
  session_date: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  record_id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  user_name?: string;
  status: AttendanceStatus;
  recorded_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSummary {
  user_id: string;
  user_name?: string;
  total_recorded: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  percentage: number;
}

// ─── Phase 12 – Course Templates, Backup, Restore & Course Copy ───────────────

export type JobStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface CopyJobOptions {
  title?: string;
  course_code?: string;
  include_content?: boolean;
  include_assessments?: boolean;
  include_gradebook?: boolean;
  include_forums?: boolean;
  include_completion?: boolean;
  include_calendar?: boolean;
  include_cohorts?: boolean;
}

export interface CopyJob {
  job_id: string;
  tenant_id: string;
  source_course_id: string;
  target_course_id?: string;
  source_course_title?: string;
  target_course_title?: string;
  options: CopyJobOptions;
  status: JobStatus;
  error_message?: string;
  created_by?: string;
  created_at: string;
  completed_at?: string;
}

export interface BackupJobOptions {
  include_files?: boolean;
  include_submissions?: boolean;
}

export interface BackupJob {
  job_id: string;
  tenant_id: string;
  course_id: string;
  course_title?: string;
  options: BackupJobOptions;
  status: JobStatus;
  error_message?: string;
  file_path?: string;
  file_size_bytes?: number;
  created_by?: string;
  created_at: string;
  completed_at?: string;
}

export interface RestoreJob {
  job_id: string;
  tenant_id: string;
  target_course_id?: string;
  target_course_title?: string;
  source_file_path?: string;
  manifest_version?: string;
  options: Record<string, unknown>;
  status: JobStatus;
  error_message?: string;
  warnings: string[];
  created_by?: string;
  created_at: string;
  completed_at?: string;
}

export interface CourseTemplate {
  course_id: string;
  tenant_id: string;
  course_code: string;
  title: string;
  description?: string;
  template_category?: string;
  template_tags: string[];
  template_description?: string;
  created_at: string;
  updated_at: string;
}

// ─── Phase 13 – Competencies, Outcomes & Programme-Level Tracking ─────────────

export type CompetencySource = 'manual' | 'csv' | 'case';
export type ProficiencyRating = 'not_yet' | 'beginning' | 'developing' | 'proficient' | 'advanced';
export type ProficiencyExpectation = 'introduced' | 'developing' | 'demonstrated' | 'mastered';
export type EvidenceSourceType = 'assignment' | 'quiz' | 'teacher_judgment' | 'portfolio';
export type RatingSource = 'automatic' | 'teacher';
export type CompetencyAggregationStrategy = 'latest' | 'highest' | 'average' | 'manual';

export interface CompetencyFramework {
  framework_id: string;
  tenant_id: string;
  name: string;
  version: string;
  source: CompetencySource;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  competency_count?: number;
}

export interface Competency {
  competency_id: string;
  framework_id: string;
  tenant_id: string;
  parent_id?: string;
  short_name: string;
  description?: string;
  idnumber?: string;
  level: number;
  created_at: string;
  updated_at: string;
  children?: Competency[];
}

export interface CourseCompetencyLink {
  link_id: string;
  tenant_id: string;
  course_id: string;
  competency_id: string;
  competency_short_name?: string;
  proficiency_expectation: ProficiencyExpectation;
  created_at: string;
}

export interface ActivityCompetencyLink {
  link_id: string;
  tenant_id: string;
  module_id: string;
  competency_id: string;
  competency_short_name?: string;
  created_at: string;
}

export interface CompetencyEvidence {
  evidence_id: string;
  tenant_id: string;
  competency_id: string;
  competency_short_name?: string;
  user_id: string;
  user_name?: string;
  course_id?: string;
  source_type: EvidenceSourceType;
  source_id?: string;
  proficiency_rating: ProficiencyRating;
  rating_source: RatingSource;
  evidence_date: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface CompetencyProfile {
  profile_id: string;
  tenant_id: string;
  user_id: string;
  competency_id: string;
  competency_short_name?: string;
  framework_id?: string;
  proficiency_rating: ProficiencyRating;
  aggregation_strategy: CompetencyAggregationStrategy;
  evidence_count: number;
  last_evidence_at?: string;
  updated_at: string;
}

export interface Programme {
  programme_id: string;
  tenant_id: string;
  name: string;
  code: string;
  description?: string;
  framework_id?: string;
  framework_name?: string;
  course_ids: string[];
  settings: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProgrammeCompetencyReport {
  report_id: string;
  tenant_id: string;
  programme_id: string;
  competency_id: string;
  competency_short_name?: string;
  total_learners: number;
  not_yet_count: number;
  beginning_count: number;
  developing_count: number;
  proficient_count: number;
  advanced_count: number;
  proficient_pct: number;
  refreshed_at: string;
}

// ─── Phase 14 – Kanban, Issues & User Stories ─────────────────────────────────

export type BoardRole = 'viewer' | 'contributor' | 'member' | 'manager' | 'admin';
export type BoardStatus = 'active' | 'archived';
export type CardPriority = 'low' | 'medium' | 'high' | 'critical';
export type IssueType = 'bug' | 'feature' | 'improvement' | 'task' | 'question';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
export type StoryStatus = 'draft' | 'ready' | 'in_progress' | 'done' | 'rejected';

export interface KanbanBoardTemplate {
  template_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  lane_definitions: Array<{
    title: string;
    color?: string;
    wip_limit?: number;
    is_done_lane?: boolean;
  }>;
  seed_cards: unknown[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface KanbanBoard {
  board_id: string;
  tenant_id: string;
  course_id: string;
  cohort_id?: string;
  owner_user_id?: string;
  owner_display_name?: string;
  title: string;
  description?: string;
  template_id?: string;
  status: BoardStatus;
  settings: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  lane_count?: number;
  card_count?: number;
}

export interface KanbanLane {
  lane_id: string;
  board_id: string;
  tenant_id: string;
  title: string;
  position: number;
  color: string;
  wip_limit: number;
  is_done_lane: boolean;
  created_at: string;
  updated_at: string;
  card_count?: number;
}

export interface KanbanCard {
  card_id: string;
  board_id: string;
  lane_id: string;
  tenant_id: string;
  title: string;
  description?: string;
  assignees: string[];
  assignee_names?: string[];
  start_date?: string;
  end_date?: string;
  time_worked_minutes: number;
  tags: string[];
  flags: string[];
  position: number;
  priority: CardPriority;
  story_points?: number;
  issue_id?: string;
  user_story_id?: string;
  archived: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface KanbanCardTimeLog {
  time_log_id: string;
  card_id: string;
  tenant_id: string;
  user_id: string;
  user_display_name?: string;
  minutes: number;
  logged_at: string;
  note?: string;
}

export interface KanbanBoardMember {
  member_id: string;
  board_id: string;
  tenant_id: string;
  user_id: string;
  user_display_name?: string;
  board_role: BoardRole;
  added_by?: string;
  added_at: string;
}

export interface Issue {
  issue_id: string;
  tenant_id: string;
  course_id: string;
  board_id?: string;
  user_story_id?: string;
  user_story_title?: string;
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  priority: CardPriority;
  reporter_id?: string;
  reporter_name?: string;
  assignees: string[];
  assignee_names?: string[];
  labels: string[];
  due_date?: string;
  resolved_at?: string;
  comment_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IssueComment {
  comment_id: string;
  issue_id: string;
  tenant_id: string;
  user_id: string;
  user_display_name?: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface UserStory {
  story_id: string;
  tenant_id: string;
  course_id: string;
  title: string;
  as_a?: string;
  i_want?: string;
  so_that?: string;
  acceptance_criteria?: string;
  priority: CardPriority;
  status: StoryStatus;
  story_points?: number;
  assignees: string[];
  assignee_names?: string[];
  labels: string[];
  competency_id?: string;
  competency_short_name?: string;
  issue_count?: number;
  card_count?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
