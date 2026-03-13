import type {
  Tenant, User, Course, CourseSection, CourseModule,
  Forum, ForumThread, ForumPost, Assignment, AssignmentSubmission,
  Grade, GradeItem, Message, Notification, Role, Permission,
  Enrolment, Cohort,
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
  async getGradeItems(courseId: string) {
    return this.request<PaginatedResponse<GradeItem>>(`/gradebook/${courseId}/items`);
  }
  async updateGrade(itemId: string, userId: string, data: Partial<Grade>) {
    return this.request<Grade>(`/gradebook/grades`, {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId, user_id: userId, ...data }),
    });
  }

  // Messages
  async getConversations() {
    return this.request<PaginatedResponse<{ conversation_id: string; title?: string; created_at: string }>>('/messages/conversations');
  }
  async getMessages(conversationId: string) {
    return this.request<PaginatedResponse<Message>>(`/messages/conversations/${conversationId}/messages`);
  }
  async sendMessage(conversationId: string, body: Record<string, unknown>) {
    return this.request<Message>(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
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
}
