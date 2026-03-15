import type {
  Tenant, User, Course, CourseSection, CourseModule,
  Forum, ForumThread, ForumPost, Assignment, AssignmentSubmission,
  Grade, GradeItem, Message, Notification, Role, Permission,
  Enrolment, Cohort, Announcement, PresenceSession, Conversation,
  Term, CourseGroup, CourseGrouping, EnrolmentMethod,
  RetentionPolicy, CourseArchive, ExportJob, AuditEvent,
  EnrolmentReport, ActivityReport, CompletionReport,
  Plugin, PluginVersion, Webhook, WebhookDelivery,
  IntegrationConnector, AutomationRule, AutomationLog,
  FeatureFlag, DeveloperApiKey,
  PaginatedResponse,
} from '@ako/shared';

export interface AkoClientOptions {
  baseUrl: string;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
}

export class AkoClient {
  private baseUrl: string;
  private getToken: () => string | null;
  private onUnauthorized?: () => void;

  constructor(options: AkoClientOptions) {
    this.baseUrl = options.baseUrl;
    this.getToken = options.getToken ?? (() => null);
    this.onUnauthorized = options.onUnauthorized;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    if (response.status === 401) {
      this.onUnauthorized?.();
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ title: response.statusText }));
      throw new Error((error as { detail?: string; title?: string }).detail ?? (error as { title?: string }).title ?? 'Request failed');
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private toQueryString(params?: Record<string, unknown>): string {
    if (!params) return '';
    const entries = Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]);
    return entries.length > 0 ? '?' + new URLSearchParams(entries).toString() : '';
  }

  // Auth
  async login(username: string, password: string) {
    return this.request<{ accessToken: string; refreshToken: string }>('/auth/token', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async refreshToken(refreshToken: string) {
    return this.request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async getMe() {
    return this.request<User>('/auth/me');
  }

  async register(data: { username: string; email: string; password: string; display_name: string; tenant_id?: string }) {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Tenants
  async getTenants(cursor?: string) {
    const q = cursor ? `?cursor=${cursor}` : '';
    return this.request<PaginatedResponse<Tenant>>(`/tenants${q}`);
  }
  async getTenant(id: string) {
    return this.request<Tenant>(`/tenants/${id}`);
  }
  async createTenant(data: Partial<Tenant>) {
    return this.request<Tenant>('/tenants', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateTenant(id: string, data: Partial<Tenant>) {
    return this.request<Tenant>(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteTenant(id: string) {
    return this.request<void>(`/tenants/${id}`, { method: 'DELETE' });
  }

  // Users
  async getUsers(cursor?: string) {
    const q = cursor ? `?cursor=${cursor}` : '';
    return this.request<PaginatedResponse<User>>(`/users${q}`);
  }
  async getUser(id: string) {
    return this.request<User>(`/users/${id}`);
  }
  async createUser(data: Partial<User> & { password?: string }) {
    return this.request<User>('/users', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateUser(id: string, data: Partial<User>) {
    return this.request<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteUser(id: string) {
    return this.request<void>(`/users/${id}`, { method: 'DELETE' });
  }

  // Roles
  async getRoles(cursor?: string) {
    const q = cursor ? `?cursor=${cursor}` : '';
    return this.request<PaginatedResponse<Role>>(`/roles${q}`);
  }
  async getRole(id: string) {
    return this.request<Role>(`/roles/${id}`);
  }
  async createRole(data: Partial<Role>) {
    return this.request<Role>('/roles', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateRole(id: string, data: Partial<Role>) {
    return this.request<Role>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteRole(id: string) {
    return this.request<void>(`/roles/${id}`, { method: 'DELETE' });
  }
  async getRolePermissions(roleId: string) {
    return this.request<Permission[]>(`/roles/${roleId}/permissions`);
  }
  async addRolePermission(roleId: string, permissionId: string) {
    return this.request<void>(`/roles/${roleId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ permission_id: permissionId }),
    });
  }
  async removeRolePermission(roleId: string, permissionId: string) {
    return this.request<void>(`/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' });
  }

  // Courses
  async getCourses(cursor?: string) {
    const q = cursor ? `?cursor=${cursor}` : '';
    return this.request<PaginatedResponse<Course>>(`/courses${q}`);
  }
  async getCourse(id: string) {
    return this.request<Course>(`/courses/${id}`);
  }
  async createCourse(data: Partial<Course>) {
    return this.request<Course>('/courses', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateCourse(id: string, data: Partial<Course>) {
    return this.request<Course>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteCourse(id: string) {
    return this.request<void>(`/courses/${id}`, { method: 'DELETE' });
  }

  // Course sections
  async getSections(courseId: string) {
    return this.request<PaginatedResponse<CourseSection>>(`/courses/${courseId}/sections`);
  }
  async createSection(courseId: string, data: Partial<CourseSection>) {
    return this.request<CourseSection>(`/courses/${courseId}/sections`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateSection(courseId: string, sectionId: string, data: Partial<CourseSection>) {
    return this.request<CourseSection>(`/courses/${courseId}/sections/${sectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  async deleteSection(courseId: string, sectionId: string) {
    return this.request<void>(`/courses/${courseId}/sections/${sectionId}`, { method: 'DELETE' });
  }

  // Course modules
  async getModules(courseId: string) {
    return this.request<PaginatedResponse<CourseModule>>(`/courses/${courseId}/modules`);
  }
  async createModule(courseId: string, data: Partial<CourseModule>) {
    return this.request<CourseModule>(`/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateModule(courseId: string, moduleId: string, data: Partial<CourseModule>) {
    return this.request<CourseModule>(`/courses/${courseId}/modules/${moduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  async deleteModule(courseId: string, moduleId: string) {
    return this.request<void>(`/courses/${courseId}/modules/${moduleId}`, { method: 'DELETE' });
  }

  // Enrolments
  async getEnrolments(courseId: string) {
    return this.request<PaginatedResponse<Enrolment>>(`/courses/${courseId}/enrolments`);
  }
  async enrol(courseId: string, data: Partial<Enrolment>) {
    return this.request<Enrolment>(`/courses/${courseId}/enrolments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateEnrolment(courseId: string, enrolmentId: string, data: Partial<Enrolment>) {
    return this.request<Enrolment>(`/courses/${courseId}/enrolments/${enrolmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  async unenrol(courseId: string, enrolmentId: string) {
    return this.request<void>(`/courses/${courseId}/enrolments/${enrolmentId}`, { method: 'DELETE' });
  }

  // Cohorts
  async getCohorts(cursor?: string) {
    const q = cursor ? `?cursor=${cursor}` : '';
    return this.request<PaginatedResponse<Cohort>>(`/cohorts${q}`);
  }
  async getCohort(id: string) {
    return this.request<Cohort>(`/cohorts/${id}`);
  }
  async createCohort(data: Partial<Cohort>) {
    return this.request<Cohort>('/cohorts', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateCohort(id: string, data: Partial<Cohort>) {
    return this.request<Cohort>(`/cohorts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteCohort(id: string) {
    return this.request<void>(`/cohorts/${id}`, { method: 'DELETE' });
  }
  async getCohortMembers(id: string) {
    return this.request<PaginatedResponse<User & { added_at: string }>>(`/cohorts/${id}/members`);
  }
  async addCohortMember(cohortId: string, userId: string) {
    return this.request<{ cohort_id: string; user_id: string }>(`/cohorts/${cohortId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }
  async removeCohortMember(cohortId: string, userId: string) {
    return this.request<void>(`/cohorts/${cohortId}/members/${userId}`, { method: 'DELETE' });
  }
  async bulkAddCohortMembers(cohortId: string, userIds: string[]) {
    return this.request<{ cohort_id: string; added: number }>(`/cohorts/${cohortId}/members/bulkAdd`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds }),
    });
  }
  async bulkRemoveCohortMembers(cohortId: string, userIds: string[]) {
    return this.request<{ cohort_id: string; removed: number }>(`/cohorts/${cohortId}/members/bulkRemove`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds }),
    });
  }
  async reconcileCohortSync(cohortId: string) {
    return this.request<{ cohort_id: string; courses_synced: number; enrolments_upserted: number }>(`/cohorts/${cohortId}/sync/reconcile`, { method: 'POST' });
  }
  async getCohortCourses(cohortId: string) {
    return this.request<PaginatedResponse<Course & { method_id: string; method_type: string; default_role: string }>>(`/cohorts/${cohortId}/courses`);
  }

  // Terms
  async getTerms() {
    return this.request<PaginatedResponse<Term>>('/terms');
  }
  async getTerm(id: string) {
    return this.request<Term>(`/terms/${id}`);
  }
  async createTerm(data: Partial<Term>) {
    return this.request<Term>('/terms', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateTerm(id: string, data: Partial<Term>) {
    return this.request<Term>(`/terms/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteTerm(id: string) {
    return this.request<void>(`/terms/${id}`, { method: 'DELETE' });
  }

  // Course publish
  async publishCourse(id: string) {
    return this.request<Course>(`/courses/${id}/publish`, { method: 'POST' });
  }

  // Course groups
  async getCourseGroups(courseId: string) {
    return this.request<PaginatedResponse<CourseGroup>>(`/courses/${courseId}/groups`);
  }
  async createCourseGroup(courseId: string, data: { name: string; cohort_id?: string }) {
    return this.request<CourseGroup>(`/courses/${courseId}/groups`, { method: 'POST', body: JSON.stringify(data) });
  }
  async deleteCourseGroup(courseId: string, groupId: string) {
    return this.request<void>(`/courses/${courseId}/groups/${groupId}`, { method: 'DELETE' });
  }

  // Course groupings
  async getCourseGroupings(courseId: string) {
    return this.request<PaginatedResponse<CourseGrouping & { groups: { group_id: string; name: string }[] }>>(`/courses/${courseId}/groupings`);
  }
  async createCourseGrouping(courseId: string, data: { name: string }) {
    return this.request<CourseGrouping>(`/courses/${courseId}/groupings`, { method: 'POST', body: JSON.stringify(data) });
  }
  async addGroupsToGrouping(courseId: string, groupingId: string, groupIds: string[]) {
    return this.request<{ grouping_id: string; group_ids: string[] }>(`/courses/${courseId}/groupings/${groupingId}/groups`, {
      method: 'POST',
      body: JSON.stringify({ group_ids: groupIds }),
    });
  }
  async deleteCourseGrouping(courseId: string, groupingId: string) {
    return this.request<void>(`/courses/${courseId}/groupings/${groupingId}`, { method: 'DELETE' });
  }

  // Enrolment methods
  async getEnrolmentMethods(courseId: string) {
    return this.request<PaginatedResponse<EnrolmentMethod>>(`/courses/${courseId}/enrolment-methods`);
  }
  async createEnrolmentMethod(courseId: string, data: Partial<EnrolmentMethod>) {
    return this.request<EnrolmentMethod>(`/courses/${courseId}/enrolment-methods`, { method: 'POST', body: JSON.stringify(data) });
  }
  async deleteEnrolmentMethod(courseId: string, methodId: string) {
    return this.request<void>(`/courses/${courseId}/enrolment-methods/${methodId}`, { method: 'DELETE' });
  }

  // Reconciliation
  async reconcileCourseEnrolments(courseId: string) {
    return this.request<{ course_id: string; added: number; suspended: number; methods_processed: number }>(`/courses/${courseId}/enrolments/reconcile`, { method: 'POST' });
  }

  // Module visibility / move
  async hideModule(courseId: string, moduleId: string) {
    return this.request<CourseModule>(`/courses/${courseId}/modules/${moduleId}/hide`, { method: 'POST' });
  }
  async showModule(courseId: string, moduleId: string) {
    return this.request<CourseModule>(`/courses/${courseId}/modules/${moduleId}/show`, { method: 'POST' });
  }
  async moveModule(courseId: string, moduleId: string, data: { position: number; section_id?: string }) {
    return this.request<CourseModule>(`/courses/${courseId}/modules/${moduleId}/move`, { method: 'POST', body: JSON.stringify(data) });
  }

  // Forums
  async getForums(params?: Record<string, string>) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<PaginatedResponse<Forum>>(`/forums${q}`);
  }
  async getForum(id: string) {
    return this.request<Forum>(`/forums/${id}`);
  }
  async getThreads(forumId: string) {
    return this.request<PaginatedResponse<ForumThread>>(`/forums/${forumId}/threads`);
  }
  async getThread(forumId: string, threadId: string) {
    return this.request<ForumThread>(`/forums/${forumId}/threads/${threadId}`);
  }
  async createThread(forumId: string, data: Partial<ForumThread>) {
    return this.request<ForumThread>(`/forums/${forumId}/threads`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async getPosts(forumId: string, threadId: string) {
    return this.request<PaginatedResponse<ForumPost>>(`/forums/${forumId}/threads/${threadId}/posts`);
  }
  async createPost(forumId: string, threadId: string, body: Record<string, unknown>) {
    return this.request<ForumPost>(`/forums/${forumId}/threads/${threadId}/posts`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  async updatePost(forumId: string, threadId: string, postId: string, body: Record<string, unknown>) {
    return this.request<ForumPost>(`/forums/${forumId}/threads/${threadId}/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }
  async deletePost(forumId: string, threadId: string, postId: string) {
    return this.request<void>(`/forums/${forumId}/threads/${threadId}/posts/${postId}`, { method: 'DELETE' });
  }
  async addPostReaction(forumId: string, threadId: string, postId: string, reaction: string) {
    return this.request<{ post_id: string; reaction: string }>(
      `/forums/${forumId}/threads/${threadId}/posts/${postId}/reactions`,
      { method: 'POST', body: JSON.stringify({ reaction }) }
    );
  }
  async removePostReaction(forumId: string, threadId: string, postId: string, reaction: string) {
    return this.request<void>(
      `/forums/${forumId}/threads/${threadId}/posts/${postId}/reactions/${encodeURIComponent(reaction)}`,
      { method: 'DELETE' }
    );
  }

  // Assignments
  async getAssignment(id: string) {
    return this.request<Assignment>(`/assignments/${id}`);
  }
  async getSubmissions(assignmentId: string) {
    return this.request<PaginatedResponse<AssignmentSubmission>>(`/assignments/${assignmentId}/submissions`);
  }
  async submitAssignment(assignmentId: string, data: Partial<AssignmentSubmission>) {
    return this.request<AssignmentSubmission>(`/assignments/${assignmentId}/submissions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Grades
  async getGradebook(courseId: string) {
    return this.request<{ items: GradeItem[]; grades: Grade[] }>(`/courses/${courseId}/gradebook`);
  }
  async getGradeItems(courseId?: string) {
    return this.request<{ data: GradeItem[] }>(`/gradebook/items${courseId ? `?course_id=${courseId}` : ''}`);
  }
  async getGrades(itemId?: string, userId?: string) {
    const params: Record<string, string> = {};
    if (itemId) params['item_id'] = itemId;
    if (userId) params['user_id'] = userId;
    return this.request<{ data: Grade[] }>(`/gradebook/grades${this.toQueryString(params)}`);
  }
  async upsertGrade(data: { item_id: string; user_id: string; grade?: number; feedback?: string }) {
    return this.request<Grade>('/gradebook/grades', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateGrade(itemId: string, userId: string, data: Partial<Grade>) {
    return this.request<Grade>(`/gradebook/grades`, {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId, user_id: userId, ...data }),
    });
  }

  // Messages
  async getConversations() {
    return this.request<PaginatedResponse<Conversation>>('/messages/conversations');
  }
  async getConversation(id: string) {
    return this.request<Conversation>(`/messages/conversations/${id}`);
  }
  async createConversation(data: { member_ids: string[]; convo_type?: string; course_id?: string; cohort_id?: string }) {
    return this.request<Conversation>('/messages/conversations', { method: 'POST', body: JSON.stringify(data) });
  }
  async getMessages(conversationId: string) {
    return this.request<PaginatedResponse<Message>>(`/messages/conversations/${conversationId}/messages`);
  }
  async sendMessage(conversationId: string, body: Record<string, unknown>) {
    return this.request<Message>(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }
  async markConversationRead(conversationId: string) {
    return this.request<void>(`/messages/conversations/${conversationId}/read`, { method: 'POST' });
  }
  async addMessageReaction(conversationId: string, messageId: string, reaction: string) {
    return this.request<{ message_id: string; reaction: string }>(
      `/messages/conversations/${conversationId}/messages/${messageId}/reactions`,
      { method: 'POST', body: JSON.stringify({ reaction }) }
    );
  }
  async removeMessageReaction(conversationId: string, messageId: string, reaction: string) {
    return this.request<void>(
      `/messages/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(reaction)}`,
      { method: 'DELETE' }
    );
  }

  // Announcements
  async getCourseAnnouncements(courseId: string, cursor?: string) {
    const q = cursor ? `?cursor=${cursor}` : '';
    return this.request<PaginatedResponse<Announcement>>(`/courses/${courseId}/announcements${q}`);
  }
  async createAnnouncement(courseId: string, data: Partial<Announcement>) {
    return this.request<Announcement>(`/courses/${courseId}/announcements`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async getAnnouncement(id: string) {
    return this.request<Announcement>(`/announcements/${id}`);
  }
  async updateAnnouncement(id: string, data: Partial<Announcement>) {
    return this.request<Announcement>(`/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteAnnouncement(id: string) {
    return this.request<void>(`/announcements/${id}`, { method: 'DELETE' });
  }

  // Presence
  async updatePresence(data: { status: 'online' | 'idle' | 'offline'; context_type?: string; context_id?: string }) {
    return this.request<PresenceSession>('/presence', { method: 'POST', body: JSON.stringify(data) });
  }
  async getPresence(userIds?: string[]) {
    const q = userIds?.length ? `?user_ids=${userIds.join(',')}` : '';
    return this.request<PaginatedResponse<PresenceSession>>(`/presence${q}`);
  }
  async setOffline() {
    return this.request<void>('/presence', { method: 'DELETE' });
  }

  // Forum subscriptions and read tracking
  async subscribeToThread(forumId: string, threadId: string) {
    return this.request<void>(`/forums/${forumId}/threads/${threadId}/subscribe`, { method: 'POST' });
  }
  async unsubscribeFromThread(forumId: string, threadId: string) {
    return this.request<void>(`/forums/${forumId}/threads/${threadId}/subscribe`, { method: 'DELETE' });
  }
  async markThreadRead(forumId: string, threadId: string) {
    return this.request<void>(`/forums/${forumId}/threads/${threadId}/read`, { method: 'POST' });
  }
  async lockThread(forumId: string, threadId: string) {
    return this.request<ForumThread>(`/forums/${forumId}/threads/${threadId}/lock`, { method: 'POST' });
  }
  async unlockThread(forumId: string, threadId: string) {
    return this.request<ForumThread>(`/forums/${forumId}/threads/${threadId}/unlock`, { method: 'POST' });
  }
  async pinThread(forumId: string, threadId: string) {
    return this.request<ForumThread>(`/forums/${forumId}/threads/${threadId}/pin`, { method: 'POST' });
  }
  async unpinThread(forumId: string, threadId: string) {
    return this.request<ForumThread>(`/forums/${forumId}/threads/${threadId}/unpin`, { method: 'POST' });
  }

  // Notifications
  async getNotifications(cursor?: string) {
    const q = cursor ? `?cursor=${cursor}` : '';
    return this.request<PaginatedResponse<Notification>>(`/notifications${q}`);
  }
  async markNotificationRead(id: string) {
    return this.request<Notification>(`/notifications/${id}/read`, { method: 'POST' });
  }
  async markAllNotificationsRead() {
    return this.request<void>('/notifications/read-all', { method: 'POST' });
  }

  // ── Phase 4: Archiving ──────────────────────────────────────────────────────
  async archiveCourse(courseId: string, data?: { notes?: string; trigger_type?: string }) {
    return this.request<CourseArchive>(`/courses/${courseId}/archive`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    });
  }
  async restoreCourse(courseId: string) {
    return this.request<Course>(`/courses/${courseId}/restore`, { method: 'POST' });
  }
  async getCourseArchive(courseId: string) {
    return this.request<CourseArchive>(`/courses/${courseId}/archive`);
  }
  async setLegalHold(courseId: string, hold: boolean) {
    return this.request<Course>(`/courses/${courseId}/legal-hold`, {
      method: 'POST',
      body: JSON.stringify({ hold }),
    });
  }
  async assignRetentionPolicy(courseId: string, policyId: string) {
    return this.request<Course>(`/courses/${courseId}/retention-policy`, {
      method: 'POST',
      body: JSON.stringify({ policy_id: policyId }),
    });
  }

  // ── Phase 4: Retention Policies ─────────────────────────────────────────────
  async getRetentionPolicies(cursor?: string) {
    const q = cursor ? `?cursor=${cursor}` : '';
    return this.request<PaginatedResponse<RetentionPolicy>>(`/retention-policies${q}`);
  }
  async getRetentionPolicy(id: string) {
    return this.request<RetentionPolicy>(`/retention-policies/${id}`);
  }
  async createRetentionPolicy(data: Partial<RetentionPolicy>) {
    return this.request<RetentionPolicy>('/retention-policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateRetentionPolicy(id: string, data: Partial<RetentionPolicy>) {
    return this.request<RetentionPolicy>(`/retention-policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  async deleteRetentionPolicy(id: string) {
    return this.request<void>(`/retention-policies/${id}`, { method: 'DELETE' });
  }

  // ── Phase 4: Reports ─────────────────────────────────────────────────────────
  async getEnrolmentReport(courseId?: string) {
    const q = courseId ? `?course_id=${courseId}` : '';
    return this.request<{ data: EnrolmentReport[] }>(`/reports/enrolments${q}`);
  }
  async getActivityReport(courseId?: string) {
    const q = courseId ? `?course_id=${courseId}` : '';
    return this.request<{ data: ActivityReport[] }>(`/reports/activity${q}`);
  }
  async getCompletionReport(courseId?: string) {
    const q = courseId ? `?course_id=${courseId}` : '';
    return this.request<{ data: CompletionReport[] }>(`/reports/completion${q}`);
  }
  async getForumEngagementReport(courseId?: string) {
    const q = courseId ? `?course_id=${courseId}` : '';
    return this.request<{ data: Record<string, unknown>[] }>(`/reports/forum-engagement${q}`);
  }

  // ── Phase 4: Exports ─────────────────────────────────────────────────────────
  async createExport(data: {
    export_type: 'course_archive' | 'assessment_evidence' | 'engagement_metrics';
    course_id?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request<ExportJob>('/exports', { method: 'POST', body: JSON.stringify(data) });
  }
  async getExports(cursor?: string) {
    const q = cursor ? `?cursor=${cursor}` : '';
    return this.request<PaginatedResponse<ExportJob>>(`/exports${q}`);
  }
  async getExportStatus(id: string) {
    return this.request<ExportJob>(`/exports/${id}/status`);
  }
  async getExportDownload(id: string) {
    return this.request<{ export_id: string; file_key: string; download_url: string; expires_at: string }>(
      `/exports/${id}/download`
    );
  }

  // ── Phase 4: Audit ───────────────────────────────────────────────────────────
  async getAuditEvents(params?: {
    cursor?: string;
    limit?: number;
    event_type?: string;
    resource_type?: string;
    resource_id?: string;
    actor_id?: string;
  }) {
    const q = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString() : '';
    return this.request<PaginatedResponse<AuditEvent>>(`/audit/events${q}`);
  }

  // ── Phase 5: Plugins ─────────────────────────────────────────────────────────
  async getPlugins() {
    return this.request<{ data: Plugin[] }>('/plugins');
  }
  async getPlugin(id: string) {
    return this.request<Plugin>(`/plugins/${id}`);
  }
  async installPlugin(data: Partial<Plugin>) {
    return this.request<Plugin>('/plugins', { method: 'POST', body: JSON.stringify(data) });
  }
  async enablePlugin(id: string) {
    return this.request<Plugin>(`/plugins/${id}/enable`, { method: 'POST' });
  }
  async disablePlugin(id: string) {
    return this.request<Plugin>(`/plugins/${id}/disable`, { method: 'POST' });
  }
  async uninstallPlugin(id: string) {
    return this.request<void>(`/plugins/${id}`, { method: 'DELETE' });
  }
  async getPluginVersions(id: string) {
    return this.request<{ data: PluginVersion[] }>(`/plugins/${id}/versions`);
  }
  async publishPluginVersion(pluginId: string, data: { version: string; changelog?: string; bundle_url?: string; bundle_hash?: string }) {
    return this.request<PluginVersion>(`/plugins/${pluginId}/versions`, { method: 'POST', body: JSON.stringify(data) });
  }

  // ── Phase 5: Webhooks ────────────────────────────────────────────────────────
  async getWebhooks() {
    return this.request<{ data: Webhook[] }>('/webhooks');
  }
  async createWebhook(data: { name: string; target_url: string; event_types?: string[]; secret?: string; active?: boolean }) {
    return this.request<Webhook>('/webhooks', { method: 'POST', body: JSON.stringify(data) });
  }
  async getWebhook(id: string) {
    return this.request<Webhook>(`/webhooks/${id}`);
  }
  async updateWebhook(id: string, data: Partial<{ name: string; target_url: string; event_types: string[]; active: boolean }>) {
    return this.request<Webhook>(`/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteWebhook(id: string) {
    return this.request<void>(`/webhooks/${id}`, { method: 'DELETE' });
  }
  async testWebhookEvent(data: { event_type: string; payload?: unknown }) {
    return this.request<{ event_type: string; webhooks_notified: number; results: unknown[] }>(
      '/webhooks/events/test', { method: 'POST', body: JSON.stringify(data) }
    );
  }
  async getWebhookDeliveries(id: string) {
    return this.request<{ data: WebhookDelivery[] }>(`/webhooks/${id}/deliveries`);
  }

  // ── Phase 5: Integrations ────────────────────────────────────────────────────
  async getIntegrations() {
    return this.request<{ data: IntegrationConnector[] }>('/integrations');
  }
  async createIntegration(data: { name: string; connector_type: string; settings?: Record<string, unknown> }) {
    return this.request<IntegrationConnector>('/integrations', { method: 'POST', body: JSON.stringify(data) });
  }
  async getIntegration(id: string) {
    return this.request<IntegrationConnector>(`/integrations/${id}`);
  }
  async updateIntegration(id: string, data: Partial<IntegrationConnector>) {
    return this.request<IntegrationConnector>(`/integrations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteIntegration(id: string) {
    return this.request<void>(`/integrations/${id}`, { method: 'DELETE' });
  }
  async getIntegrationHealth(id: string) {
    return this.request<{ connector_id: string; name: string; health_status: string; latency_ms: number | null; last_health_check: string; error_message: string | null }>(
      `/integrations/${id}/health`
    );
  }

  // ── Phase 5: Automation Rules ────────────────────────────────────────────────
  async getAutomationRules() {
    return this.request<{ data: AutomationRule[] }>('/automation-rules');
  }
  async createAutomationRule(data: Partial<AutomationRule>) {
    return this.request<AutomationRule>('/automation-rules', { method: 'POST', body: JSON.stringify(data) });
  }
  async getAutomationRule(id: string) {
    return this.request<AutomationRule>(`/automation-rules/${id}`);
  }
  async updateAutomationRule(id: string, data: Partial<AutomationRule>) {
    return this.request<AutomationRule>(`/automation-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteAutomationRule(id: string) {
    return this.request<void>(`/automation-rules/${id}`, { method: 'DELETE' });
  }
  async getAutomationLogs(ruleId: string) {
    return this.request<{ data: AutomationLog[] }>(`/automation-rules/${ruleId}/logs`);
  }

  // ── Phase 5: Feature Flags ───────────────────────────────────────────────────
  async getFeatureFlags() {
    return this.request<{ data: FeatureFlag[] }>('/feature-flags');
  }
  async createFeatureFlag(data: Partial<FeatureFlag>) {
    return this.request<FeatureFlag>('/feature-flags', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateFeatureFlag(id: string, data: Partial<FeatureFlag>) {
    return this.request<FeatureFlag>(`/feature-flags/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteFeatureFlag(id: string) {
    return this.request<void>(`/feature-flags/${id}`, { method: 'DELETE' });
  }

  // ── Phase 5: Developer API Keys ──────────────────────────────────────────────
  async getDeveloperKeys() {
    return this.request<{ data: DeveloperApiKey[] }>('/developer/keys');
  }
  async createDeveloperKey(data: { name: string; scopes?: string[]; expires_at?: string }) {
    return this.request<DeveloperApiKey & { key: string }>('/developer/keys', { method: 'POST', body: JSON.stringify(data) });
  }
  async revokeDeveloperKey(id: string) {
    return this.request<void>(`/developer/keys/${id}`, { method: 'DELETE' });
  }

  // ── Phase 6: Metrics ─────────────────────────────────────────────────────────
  async getMetricsSummary() {
    return this.request<import('@ako/shared').MetricsSummary>('/metrics/summary');
  }
  async getMetricSnapshots(params?: { metric_name?: string; limit?: number }) {
    return this.request<{ data: import('@ako/shared').MetricSnapshot[] }>(
      `/metrics/snapshots${this.toQueryString(params)}`
    );
  }

  // ── Phase 6: Rate Limits ─────────────────────────────────────────────────────
  async getRateLimitConfigs() {
    return this.request<{ data: import('@ako/shared').RateLimitConfig[] }>('/rate-limits');
  }
  async createRateLimitConfig(data: Partial<import('@ako/shared').RateLimitConfig>) {
    return this.request<import('@ako/shared').RateLimitConfig>('/rate-limits', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateRateLimitConfig(id: string, data: Partial<import('@ako/shared').RateLimitConfig>) {
    return this.request<import('@ako/shared').RateLimitConfig>(`/rate-limits/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteRateLimitConfig(id: string) {
    return this.request<void>(`/rate-limits/${id}`, { method: 'DELETE' });
  }

  // ── Phase 6: Permission Audit ─────────────────────────────────────────────────
  async getPermissionMatrix() {
    return this.request<import('@ako/shared').PermissionMatrix>('/permission-audit/matrix');
  }
  async getPermissionAuditEvents(params?: {
    cursor?: string;
    limit?: number;
    permission_name?: string;
    actor_id?: string;
    granted?: boolean;
  }) {
    return this.request<{ data: import('@ako/shared').PermissionAuditLog[]; next_cursor: string | null }>(
      `/permission-audit/events${this.toQueryString(params)}`
    );
  }
  async getPermissionAnomalies() {
    return this.request<{ broad_roles: unknown[]; denial_spikes: unknown[]; evaluated_at: string }>(
      '/permission-audit/anomalies'
    );
  }

  // ── Phase 6: System Alerts ───────────────────────────────────────────────────
  async getSystemAlerts() {
    return this.request<{ data: import('@ako/shared').SystemAlert[] }>('/system-alerts');
  }
  async createSystemAlert(data: Partial<import('@ako/shared').SystemAlert>) {
    return this.request<import('@ako/shared').SystemAlert>('/system-alerts', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateSystemAlert(id: string, data: Partial<import('@ako/shared').SystemAlert>) {
    return this.request<import('@ako/shared').SystemAlert>(`/system-alerts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteSystemAlert(id: string) {
    return this.request<void>(`/system-alerts/${id}`, { method: 'DELETE' });
  }
  async getTriggeredAlerts(limit?: number) {
    const q = limit ? `?limit=${limit}` : '';
    return this.request<{ data: import('@ako/shared').SystemAlertEvent[] }>(`/system-alerts/triggered${q}`);
  }

  // ── Phase 6: Health Probes ────────────────────────────────────────────────────
  async getHealthLive() {
    return this.request<{ status: string; uptime_seconds: number; timestamp: string }>('/health/live');
  }
  async getHealthReady() {
    return this.request<{ status: string; checks: Record<string, unknown>; timestamp: string }>('/health/ready');
  }
  async getHealthStartup() {
    return this.request<{ status: string; checks: Record<string, unknown>; timestamp: string }>('/health/startup');
  }

  // ── Phase 8: Completion Tracking ─────────────────────────────────────────────

  async getModuleCompletionRule(moduleId: string) {
    return this.request<import('@ako/shared').ActivityCompletionRule>(`/completion/modules/${moduleId}/rules`);
  }
  async setModuleCompletionRule(moduleId: string, data: {
    completion_type: import('@ako/shared').CompletionType;
    passing_grade?: number;
    require_view?: boolean;
    expected_completion_date?: string;
  }) {
    return this.request<import('@ako/shared').ActivityCompletionRule>(
      `/completion/modules/${moduleId}/rules`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
  }
  async deleteModuleCompletionRule(moduleId: string) {
    return this.request<void>(`/completion/modules/${moduleId}/rules`, { method: 'DELETE' });
  }
  async getModuleCompletionStates(moduleId: string) {
    return this.request<{ data: import('@ako/shared').ActivityCompletionState[] }>(
      `/completion/modules/${moduleId}/states`
    );
  }
  async getMyModuleCompletionState(moduleId: string) {
    return this.request<import('@ako/shared').ActivityCompletionState | { module_id: string; user_id: string; state: string }>(
      `/completion/modules/${moduleId}/states/me`
    );
  }
  async markModuleComplete(moduleId: string, data?: {
    user_id?: string;
    state?: import('@ako/shared').CompletionState;
    completion_source?: 'manual' | 'teacher';
  }) {
    return this.request<import('@ako/shared').ActivityCompletionState>(
      `/completion/modules/${moduleId}/complete`,
      { method: 'POST', body: JSON.stringify(data ?? {}) }
    );
  }
  async undoModuleComplete(moduleId: string, userId?: string) {
    const q = userId ? `?user_id=${userId}` : '';
    return this.request<void>(`/completion/modules/${moduleId}/complete${q}`, { method: 'DELETE' });
  }
  async getCourseCompletionCriteria(courseId: string) {
    return this.request<{ data: import('@ako/shared').CourseCompletionCriterion[] }>(
      `/completion/courses/${courseId}/criteria`
    );
  }
  async addCourseCompletionCriterion(courseId: string, data: {
    criterion_type: import('@ako/shared').CompletionCriterionType;
    settings?: Record<string, unknown>;
  }) {
    return this.request<import('@ako/shared').CourseCompletionCriterion>(
      `/completion/courses/${courseId}/criteria`,
      { method: 'POST', body: JSON.stringify(data) }
    );
  }
  async deleteCourseCompletionCriterion(courseId: string, criterionId: string) {
    return this.request<void>(`/completion/courses/${courseId}/criteria/${criterionId}`, { method: 'DELETE' });
  }
  async getMyCourseProgress(courseId: string) {
    return this.request<import('@ako/shared').CourseProgressSummary>(`/completion/courses/${courseId}/progress`);
  }
  async getCourseProgressSummary(courseId: string) {
    return this.request<{ data: import('@ako/shared').LearnerProgressRow[] }>(
      `/completion/courses/${courseId}/summary`
    );
  }
  async evaluateCourseCompletion(courseId: string) {
    return this.request<{ evaluated: number; succeeded: number }>(
      `/completion/courses/${courseId}/evaluate`,
      { method: 'POST' }
    );
  }

  // ── Phase 9: Question Bank ────────────────────────────────────────────────────

  async getQuestionCategories(params?: { course_id?: string }) {
    return this.request<{ data: import('@ako/shared').QuestionCategory[] }>(
      `/question-bank/categories${this.toQueryString(params)}`
    );
  }
  async createQuestionCategory(data: { name: string; description?: string; parent_id?: string; course_id?: string }) {
    return this.request<import('@ako/shared').QuestionCategory>('/question-bank/categories', {
      method: 'POST', body: JSON.stringify(data),
    });
  }
  async deleteQuestionCategory(id: string) {
    return this.request<void>(`/question-bank/categories/${id}`, { method: 'DELETE' });
  }
  async getQuestions(params?: { category_id?: string; status?: string; tag?: string; course_id?: string }) {
    return this.request<{ data: import('@ako/shared').QuestionWithLatestVersion[] }>(
      `/question-bank/questions${this.toQueryString(params)}`
    );
  }
  async createQuestion(data: {
    category_id?: string;
    course_id?: string;
    qtype: import('@ako/shared').QuestionType;
    status?: import('@ako/shared').QuestionStatus;
    tags?: string[];
    prompt: Record<string, unknown>;
    options?: Record<string, unknown>;
    answer_key?: Record<string, unknown>;
    points?: number;
  }) {
    return this.request<import('@ako/shared').QuestionWithLatestVersion>('/question-bank/questions', {
      method: 'POST', body: JSON.stringify(data),
    });
  }
  async getQuestion(id: string) {
    return this.request<import('@ako/shared').QuestionWithLatestVersion>(`/question-bank/questions/${id}`);
  }
  async updateQuestion(id: string, data: {
    category_id?: string;
    status?: import('@ako/shared').QuestionStatus;
    tags?: string[];
    prompt?: Record<string, unknown>;
    options?: Record<string, unknown>;
    answer_key?: Record<string, unknown>;
    points?: number;
  }) {
    return this.request<import('@ako/shared').QuestionWithLatestVersion>(`/question-bank/questions/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    });
  }
  async deprecateQuestion(id: string) {
    return this.request<void>(`/question-bank/questions/${id}`, { method: 'DELETE' });
  }
  async importQuestions(data: { questions: unknown[]; format?: 'json' | 'qti' | 'moodle' }) {
    return this.request<{ imported: number; data: import('@ako/shared').Question[] }>('/question-bank/import', {
      method: 'POST', body: JSON.stringify(data),
    });
  }
  async exportQuestions(params?: { category_id?: string; course_id?: string }) {
    return this.request<{ format: string; count: number; questions: import('@ako/shared').QuestionWithLatestVersion[] }>(
      `/question-bank/export${this.toQueryString(params)}`
    );
  }

  // ── Phase 9: Quiz Enhancements ─────────────────────────────────────────────────

  async getQuiz(id: string) {
    return this.request<Record<string, unknown>>(`/quizzes/${id}`);
  }
  async updateQuizSettings(id: string, data: {
    time_limit_minutes?: number;
    open_at?: string;
    close_at?: string;
    max_attempts?: number;
    attempt_spacing_minutes?: number;
    password?: string;
    grading_strategy?: import('@ako/shared').GradingStrategy;
    behaviour_mode?: import('@ako/shared').BehaviourMode;
  }) {
    return this.request<Record<string, unknown>>(`/quizzes/${id}/settings`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
  }
  async getQuizPools(quizId: string) {
    return this.request<{ data: import('@ako/shared').QuizQuestionPool[] }>(`/quizzes/${quizId}/pools`);
  }
  async updateQuizPools(quizId: string, pools: Partial<import('@ako/shared').QuizQuestionPool>[]) {
    return this.request<{ data: import('@ako/shared').QuizQuestionPool[] }>(`/quizzes/${quizId}/pools`, {
      method: 'PUT', body: JSON.stringify({ pools }),
    });
  }
  async getQuizAttempts(quizId: string) {
    return this.request<{ data: Record<string, unknown>[] }>(`/quizzes/${quizId}/attempts`);
  }
  async getMyQuizAttempts(quizId: string) {
    return this.request<{ data: Record<string, unknown>[] }>(`/quizzes/${quizId}/attempts/me`);
  }
  async startQuizAttempt(quizId: string, data?: { password?: string }) {
    return this.request<Record<string, unknown>>(`/quizzes/${quizId}/attempts`, {
      method: 'POST', body: JSON.stringify(data ?? {}),
    });
  }
  async updateQuizAttempt(quizId: string, attemptId: string, data: {
    status?: 'submitted' | 'graded';
    score?: number;
    finished_at?: string;
  }) {
    return this.request<Record<string, unknown>>(`/quizzes/${quizId}/attempts/${attemptId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
  }

  // ── Phase 9: Gradebook Enhancements ───────────────────────────────────────────

  async updateGradeItem(id: string, data: {
    category_id?: string;
    weight?: number;
    extra_credit?: boolean;
    hidden?: boolean;
    locked?: boolean;
    release_at?: string | null;
    grade_type?: import('@ako/shared').GradeType;
    name?: string;
    max_grade?: number;
  }) {
    return this.request<import('@ako/shared').GradeItem>(`/gradebook/items/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
  }
  async releaseGrades(data: { category_id?: string; course_id?: string; item_ids?: string[] }) {
    return this.request<{ released: number; item_ids: string[] }>('/gradebook/items/release', {
      method: 'POST', body: JSON.stringify(data),
    });
  }
  async bulkImportGrades(rows: { item_name: string; username: string; grade: number; feedback?: string }[]) {
    return this.request<{ imported: number; errors: string[] }>('/gradebook/import', {
      method: 'POST', body: JSON.stringify({ rows }),
    });
  }
  async exportGrades(params?: { course_id?: string }) {
    return this.request<{ count: number; data: Record<string, unknown>[] }>(
      `/gradebook/export${this.toQueryString(params)}`
    );
  }
  async getGradeCategories(params?: { course_id?: string }) {
    return this.request<{ data: import('@ako/shared').GradeCategory[] }>(
      `/gradebook/categories${this.toQueryString(params)}`
    );
  }
  async createGradeCategory(data: {
    course_id: string;
    parent_id?: string;
    name: string;
    aggregation_strategy?: import('@ako/shared').AggregationStrategy;
    drop_lowest?: number;
    weight?: number;
  }) {
    return this.request<import('@ako/shared').GradeCategory>('/gradebook/categories', {
      method: 'POST', body: JSON.stringify(data),
    });
  }
  async updateGradeCategory(id: string, data: Partial<import('@ako/shared').GradeCategory>) {
    return this.request<import('@ako/shared').GradeCategory>(`/gradebook/categories/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
  }
  async deleteGradeCategory(id: string) {
    return this.request<void>(`/gradebook/categories/${id}`, { method: 'DELETE' });
  }
  async getGradeScales() {
    return this.request<{ data: import('@ako/shared').GradeScale[] }>('/gradebook/scales');
  }
  async createGradeScale(data: { name: string; description?: string; levels: { name: string; value: number }[] }) {
    return this.request<import('@ako/shared').GradeScale>('/gradebook/scales', {
      method: 'POST', body: JSON.stringify(data),
    });
  }
  async deleteGradeScale(id: string) {
    return this.request<void>(`/gradebook/scales/${id}`, { method: 'DELETE' });
  }
  async getMarkingWorkflow(params?: { course_id?: string; state?: string }) {
    return this.request<{ data: import('@ako/shared').MarkingWorkflowStateRecord[] }>(
      `/gradebook/marking-workflow${this.toQueryString(params)}`
    );
  }
  async createMarkingWorkflowState(data: {
    item_id: string;
    user_id: string;
    state?: import('@ako/shared').MarkingWorkflowState;
    notes?: string;
    moderator_id?: string;
  }) {
    return this.request<import('@ako/shared').MarkingWorkflowStateRecord>('/gradebook/marking-workflow', {
      method: 'POST', body: JSON.stringify(data),
    });
  }
  async updateMarkingWorkflowState(id: string, data: {
    state: import('@ako/shared').MarkingWorkflowState;
    notes?: string;
    moderator_id?: string;
  }) {
    return this.request<import('@ako/shared').MarkingWorkflowStateRecord>(`/gradebook/marking-workflow/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
  }

  // ── Phase 10: Calendar ────────────────────────────────────────────────────

  async getCalendarEvents(params?: {
    from?: string; to?: string; context_type?: string; context_id?: string;
    source_type?: string; limit?: number; offset?: number;
  }) {
    return this.request<{ data: import('@ako/shared').CalendarEvent[]; total: number }>(
      `/calendar/events${this.toQueryString(params)}`
    );
  }

  async createCalendarEvent(data: {
    title: string;
    description?: string;
    start_at: string;
    end_at?: string;
    all_day?: boolean;
    recurrence_rule?: string;
    recurrence_exceptions?: string[];
    context_type?: import('@ako/shared').CalendarContextType;
    context_id?: string;
    visibility?: import('@ako/shared').CalendarVisibility;
    grouping_id?: string;
  }) {
    return this.request<import('@ako/shared').CalendarEvent>('/calendar/events', {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  async getCalendarEvent(id: string) {
    return this.request<import('@ako/shared').CalendarEvent>(`/calendar/events/${id}`);
  }

  async updateCalendarEvent(id: string, data: {
    title?: string;
    description?: string;
    start_at?: string;
    end_at?: string;
    all_day?: boolean;
    recurrence_rule?: string;
    recurrence_exceptions?: string[];
    context_type?: import('@ako/shared').CalendarContextType;
    context_id?: string;
    visibility?: import('@ako/shared').CalendarVisibility;
    grouping_id?: string;
    recurrence_scope?: 'single' | 'following' | 'all';
    occurrence_date?: string;
  }) {
    return this.request<import('@ako/shared').CalendarEvent>(`/calendar/events/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
  }

  async deleteCalendarEvent(id: string, params?: { scope?: 'single' | 'following' | 'all'; occurrence_date?: string }) {
    return this.request<void>(`/calendar/events/${id}${this.toQueryString(params)}`, { method: 'DELETE' });
  }

  async getCourseCalendar(courseId: string, params?: { from?: string; to?: string }) {
    return this.request<{ data: import('@ako/shared').CalendarEvent[] }>(
      `/calendar/courses/${courseId}/calendar${this.toQueryString(params)}`
    );
  }

  async getCohortCalendar(cohortId: string, params?: { from?: string; to?: string }) {
    return this.request<{ data: import('@ako/shared').CalendarEvent[] }>(
      `/calendar/cohorts/${cohortId}/calendar${this.toQueryString(params)}`
    );
  }

  async getIcalToken() {
    return this.request<import('@ako/shared').IcalTokenResponse>('/calendar/ical/token');
  }

  async getExternalCalendarSources() {
    return this.request<{ data: import('@ako/shared').ExternalCalendarSource[] }>('/calendar/external-sources');
  }

  async createExternalCalendarSource(data: {
    name: string; url: string; sync_interval_minutes?: number; active?: boolean;
  }) {
    return this.request<import('@ako/shared').ExternalCalendarSource>('/calendar/external-sources', {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  async deleteExternalCalendarSource(id: string) {
    return this.request<void>(`/calendar/external-sources/${id}`, { method: 'DELETE' });
  }

  async syncExternalCalendarSource(id: string) {
    return this.request<{ message: string; source: import('@ako/shared').ExternalCalendarSource }>(
      `/calendar/external-sources/${id}/sync`, { method: 'POST' }
    );
  }

  async getExternalCalendarEvents(params?: { from?: string; to?: string; source_id?: string }) {
    return this.request<{ data: import('@ako/shared').ExternalCalendarEvent[] }>(
      `/calendar/external-events${this.toQueryString(params)}`
    );
  }

  async getCalendarReminderPrefs() {
    return this.request<{ data: import('@ako/shared').CalendarReminderPref[] }>('/calendar/reminder-prefs');
  }

  async updateCalendarReminderPrefs(prefs: Array<{
    event_type: string; enabled: boolean; intervals?: number[];
  }>) {
    return this.request<{ data: import('@ako/shared').CalendarReminderPref[] }>('/calendar/reminder-prefs', {
      method: 'PUT', body: JSON.stringify({ prefs }),
    });
  }
}
