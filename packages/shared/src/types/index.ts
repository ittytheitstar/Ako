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

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
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
