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
  /** Phase 9 – question bank categories and questions */
  questionCategories?: MoodleQuestionCategory[];
  /** Phase 9 – gradebook structure */
  gradeCategories?: MoodleGradeCategory[];
  gradeItems?: MoodleGradeItem[];
  /** Phase 11 – lesson activities */
  lessons?: MoodleLesson[];
  /** Phase 11 – choice activities */
  choices?: MoodleChoice[];
  /** Phase 11 – glossary activities */
  glossaries?: MoodleGlossary[];
  /** Phase 11 – wiki activities */
  wikis?: MoodleWiki[];
  /** Phase 12 – file attachments */
  files?: MoodleFile[];
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
  modname: string; // page | forum | assign | quiz | resource | label | lesson | choice | glossary | wiki | workshop | …
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
  /** intro/description of the forum */
  intro?: string;
  threads: MoodleThread[];
}

export interface MoodleThread {
  id: number;
  name: string;
  userid: number;
  /** Unix timestamp of thread creation */
  created?: number;
  /** Unix timestamp of last modification */
  modified?: number;
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
  intro?: string;
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

// ── Phase 9 – Question bank ──────────────────────────────────────────────────

export interface MoodleQuestionCategory {
  id: number;
  name: string;
  info?: string;
  questions: MoodleQuestion[];
}

export interface MoodleQuestion {
  id: number;
  name: string;
  questiontext: string;
  qtype: string; // multichoice | truefalse | shortanswer | essay | numerical | …
  defaultmark: number;
  answers?: MoodleAnswer[];
}

export interface MoodleAnswer {
  id: number;
  answertext: string;
  fraction: number; // 0 to 1 – fraction of mark awarded
  feedback?: string;
}

// ── Phase 9 – Gradebook structure ────────────────────────────────────────────

export interface MoodleGradeCategory {
  id: number;
  fullname: string;
  aggregation?: number; // Moodle aggregation constant
  parentId?: number;
}

export interface MoodleGradeItem {
  id: number;
  itemname: string;
  itemtype: string; // mod | category | course | manual
  itemmodule?: string;
  grademax: number;
  grademin: number;
  aggregationcoef?: number; // weight
  categoryId?: number;
}

// ── Phase 11 – Lesson activities ─────────────────────────────────────────────

export interface MoodleLesson {
  id: number;
  name: string;
  moduleId: number;
  timelimit?: number;
  maxattempts?: number;
  grade?: number;
  pages: MoodleLessonPage[];
}

export interface MoodleLessonPage {
  id: number;
  title: string;
  contents: string;
  qtype: number; // 0=content, 1=TF, 2=MC, 3=matching, 5=essay, 6=numeric, 20=end-of-lesson
  prevpageid: number;
  nextpageid: number;
}

// ── Phase 11 – Choice activities ─────────────────────────────────────────────

export interface MoodleChoice {
  id: number;
  name: string;
  moduleId: number;
  intro?: string;
  timeclose?: number;
  allowupdate?: boolean;
  showresults?: number; // 0=never,1=after_answer,2=after_close,3=always
  limitanswers?: boolean;
  options: MoodleChoiceOption[];
}

export interface MoodleChoiceOption {
  id: number;
  text: string;
  maxanswers?: number;
}

// ── Phase 11 – Glossary activities ───────────────────────────────────────────

export interface MoodleGlossary {
  id: number;
  name: string;
  moduleId: number;
  intro?: string;
  entries: MoodleGlossaryEntry[];
}

export interface MoodleGlossaryEntry {
  id: number;
  concept: string;
  definition: string;
  userid: number;
  approved: boolean;
}

// ── Phase 11 – Wiki activities ───────────────────────────────────────────────

export interface MoodleWiki {
  id: number;
  name: string;
  moduleId: number;
  wikimode: 'collaborative' | 'individual';
  pages: MoodleWikiPage[];
}

export interface MoodleWikiPage {
  id: number;
  title: string;
  cachedcontent: string;
  userid: number;
  version: number;
  timecreated: number;
  timemodified: number;
}

// ── Phase 12 – File attachments ───────────────────────────────────────────────

export interface MoodleFile {
  id: number;
  filename: string;
  filepath: string;
  filesize: number;
  mimetype: string;
  component: string;
  filearea: string;
  itemid: number;
  contenthash: string;
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
  /** Phase 9 additions */
  questionCategories: number;
  questions: number;
  gradeCategories: number;
  gradeItems: number;
  /** Phase 11 additions */
  lessons: number;
  choices: number;
  glossaries: number;
  wikis: number;
  warnings: string[];
}

export function emptyResult(): ImportResult {
  return {
    courses: 0, sections: 0, modules: 0, users: 0,
    enrolments: 0, forums: 0, threads: 0, posts: 0,
    assignments: 0, submissions: 0, grades: 0,
    questionCategories: 0, questions: 0, gradeCategories: 0, gradeItems: 0,
    lessons: 0, choices: 0, glossaries: 0, wikis: 0,
    warnings: [],
  };
}
