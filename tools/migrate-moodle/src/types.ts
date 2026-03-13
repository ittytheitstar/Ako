/**
 * Shared types for the Moodle migration tool.
 */

export interface ImportOptions {
  akoDbUrl: string;
  tenantId?: string;
  importUsers: boolean;
  dryRun: boolean;
}

export interface BackupImportOptions extends ImportOptions {
  filePath: string;
}

export interface DatabaseImportOptions extends ImportOptions {
  sourceDbUrl: string;
}

/** Intermediate representation of a Moodle course extracted from backup/DB. */
export interface MoodleCourse {
  id: number;
  shortname: string;
  fullname: string;
  summary?: string;
  visible: boolean;
  sections: MoodleSection[];
  modules: MoodleModule[];
  users?: MoodleUser[];
  enrolments?: MoodleEnrolment[];
  forums?: MoodleForum[];
  assignments?: MoodleAssignment[];
  grades?: MoodleGrade[];
}

export interface MoodleSection {
  id: number;
  number: number;
  name?: string;
  summary?: string;
  visible: boolean;
}

export interface MoodleModule {
  id: number;
  sectionId: number;
  modname: string; // page | forum | assign | quiz | resource | label | …
  name: string;
  visible: boolean;
  settings?: Record<string, unknown>;
}

export interface MoodleUser {
  id: number;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
}

export interface MoodleEnrolment {
  userId: number;
  roleShortname: string; // student | teacher | editingteacher | …
}

export interface MoodleForum {
  id: number;
  name: string;
  moduleId: number;
  threads: MoodleThread[];
}

export interface MoodleThread {
  id: number;
  name: string;
  userid: number;
  posts: MoodlePost[];
}

export interface MoodlePost {
  id: number;
  parentid?: number;
  userid: number;
  subject: string;
  message: string;
  created: number; // unix timestamp
}

export interface MoodleAssignment {
  id: number;
  name: string;
  moduleId: number;
  duedate?: number;
  maxgrade: number;
  submissions: MoodleSubmission[];
}

export interface MoodleSubmission {
  id: number;
  userid: number;
  status: string;
  timemodified: number;
  onlinetext?: string;
}

export interface MoodleGrade {
  itemname: string;
  userid: number;
  rawgrade?: number;
  finalgrade?: number;
}

/** Result of an import operation. */
export interface ImportResult {
  courses: number;
  sections: number;
  modules: number;
  users: number;
  enrolments: number;
  forums: number;
  threads: number;
  posts: number;
  assignments: number;
  submissions: number;
  grades: number;
  warnings: string[];
}

export function emptyResult(): ImportResult {
  return {
    courses: 0, sections: 0, modules: 0, users: 0,
    enrolments: 0, forums: 0, threads: 0, posts: 0,
    assignments: 0, submissions: 0, grades: 0, warnings: [],
  };
}
