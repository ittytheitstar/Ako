import { Pool } from 'pg';
import { DatabaseImportOptions, ImportResult, emptyResult } from './types';
import { AkoImporter } from './importer';

/**
 * Imports directly from a Moodle PostgreSQL or MySQL database.
 *
 * Moodle database tables used:
 *   mdl_course, mdl_course_sections, mdl_course_modules, mdl_modules
 *   mdl_user, mdl_role_assignments, mdl_role, mdl_context
 *   mdl_forum, mdl_forum_discussions, mdl_forum_posts
 *   mdl_assign, mdl_assign_submission, mdl_assign_grades
 *   mdl_grade_items, mdl_grade_grades
 *
 * NOTE: MySQL source databases require the `mysql2` package (not included by
 *       default). Use a Postgres-compatible proxy or dump first.
 */
export async function runDatabaseImport(opts: DatabaseImportOptions): Promise<void> {
  console.log(`\n🗄️  Moodle database import`);
  console.log(`   Source  : ${opts.sourceDbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`   Target  : ${opts.akoDbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`   Dry-run : ${opts.dryRun ? 'yes' : 'no'}\n`);

  const sourcePool = new Pool({ connectionString: opts.sourceDbUrl });
  const akoPool = new Pool({ connectionString: opts.akoDbUrl });

  try {
    // Verify Moodle tables are accessible
    await sourcePool.query(`SELECT 1 FROM mdl_course LIMIT 1`);

    const courses = await fetchMoodleCourses(sourcePool, opts.importUsers);
    const importer = new AkoImporter(akoPool, opts.tenantId, opts.dryRun);

    let totals = emptyResult();
    for (const course of courses) {
      const result = await importer.importCourse(course);
      totals = mergeTotals(totals, result);
    }

    printResult(totals);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌  Import failed: ${message}`);
    process.exit(1);
  } finally {
    await sourcePool.end();
    await akoPool.end();
  }
}

/**
 * Fetch all non-site courses from the Moodle source database.
 * TODO: Add filtering options (by category, by shortname pattern, etc.)
 */
async function fetchMoodleCourses(pool: Pool, importUsers: boolean) {
  const { rows: courseRows } = await pool.query<{
    id: number; shortname: string; fullname: string; summary: string; visible: number;
  }>(`
    SELECT id, shortname, fullname, summary, visible
    FROM mdl_course
    WHERE id > 1  -- skip the site-level course
    ORDER BY id
  `);

  const courses = [];
  for (const cr of courseRows) {
    const sections = await fetchSections(pool, cr.id);
    const modules = await fetchModules(pool, cr.id);
    const forums = await fetchForums(pool, cr.id);
    const assignments = await fetchAssignments(pool, cr.id);
    const grades = await fetchGrades(pool, cr.id);
    const users = importUsers ? await fetchUsers(pool, cr.id) : [];
    const enrolments = await fetchEnrolments(pool, cr.id);

    courses.push({
      id: cr.id,
      shortname: cr.shortname,
      fullname: cr.fullname,
      summary: cr.summary ?? undefined,
      visible: cr.visible === 1,
      sections,
      modules,
      forums,
      assignments,
      grades,
      users,
      enrolments,
    });
  }
  return courses;
}

async function fetchSections(pool: Pool, courseId: number) {
  const { rows } = await pool.query<{
    id: number; section: number; name: string; summary: string; visible: number;
  }>(`SELECT id, section, name, summary, visible FROM mdl_course_sections WHERE course = $1 ORDER BY section`, [courseId]);
  return rows.map(r => ({
    id: r.id,
    number: r.section,
    name: r.name ?? undefined,
    summary: r.summary ?? undefined,
    visible: r.visible === 1,
  }));
}

async function fetchModules(pool: Pool, courseId: number) {
  const { rows } = await pool.query<{
    id: number; section: number; module: number; instance: number;
    name: string; visible: number; modname: string;
  }>(`
    SELECT cm.id, cm.section, cm.module, cm.instance, cm.visible, m.name AS modname,
           COALESCE(
             (SELECT p.name FROM mdl_page p WHERE p.id = cm.instance AND m.name = 'page' LIMIT 1),
             (SELECT a.name FROM mdl_assign a WHERE a.id = cm.instance AND m.name = 'assign' LIMIT 1),
             (SELECT f.name FROM mdl_forum f WHERE f.id = cm.instance AND m.name = 'forum' LIMIT 1),
             (SELECT q.name FROM mdl_quiz q WHERE q.id = cm.instance AND m.name = 'quiz' LIMIT 1),
             (SELECT r.name FROM mdl_resource r WHERE r.id = cm.instance AND m.name = 'resource' LIMIT 1),
             m.name || '#' || cm.instance::text
           ) AS name
    FROM mdl_course_modules cm
    JOIN mdl_modules m ON m.id = cm.module
    WHERE cm.course = $1
    ORDER BY cm.section, cm.id
  `, [courseId]);
  return rows.map(r => ({
    id: r.id,
    sectionId: r.section,
    modname: r.modname,
    name: r.name ?? r.modname,
    visible: r.visible === 1,
  }));
}

async function fetchForums(pool: Pool, courseId: number) {
  const { rows: forumRows } = await pool.query<{ id: number; name: string; }>(`
    SELECT f.id, f.name FROM mdl_forum f WHERE f.course = $1
  `, [courseId]);

  const forums = [];
  for (const fr of forumRows) {
    const { rows: threadRows } = await pool.query<{ id: number; name: string; userid: number; }>(`
      SELECT id, name, userid FROM mdl_forum_discussions WHERE forum = $1
    `, [fr.id]);

    const threads = [];
    for (const tr of threadRows) {
      const { rows: postRows } = await pool.query<{
        id: number; parent: number; userid: number; subject: string; message: string; created: number;
      }>(`SELECT id, parent, userid, subject, message, created FROM mdl_forum_posts WHERE discussion = $1`, [tr.id]);
      threads.push({
        id: tr.id,
        name: tr.name,
        userid: tr.userid,
        posts: postRows.map(p => ({
          id: p.id,
          parentid: p.parent || undefined,
          userid: p.userid,
          subject: p.subject,
          message: p.message,
          created: p.created,
        })),
      });
    }
    forums.push({ id: fr.id, name: fr.name, moduleId: 0, threads });
  }
  return forums;
}

async function fetchAssignments(pool: Pool, courseId: number) {
  const { rows } = await pool.query<{ id: number; name: string; duedate: number; grade: number; }>(`
    SELECT id, name, duedate, grade FROM mdl_assign WHERE course = $1
  `, [courseId]);
  const assignments = [];
  for (const r of rows) {
    const { rows: subRows } = await pool.query<{
      id: number; userid: number; status: string; timemodified: number; onlinetext: string;
    }>(`SELECT id, userid, status, timemodified, onlinetext FROM mdl_assign_submission WHERE assignment = $1`, [r.id]);
    assignments.push({
      id: r.id, name: r.name,
      moduleId: 0,
      duedate: r.duedate || undefined,
      maxgrade: r.grade,
      submissions: subRows.map(s => ({
        id: s.id, userid: s.userid, status: s.status,
        timemodified: s.timemodified, onlinetext: s.onlinetext ?? undefined,
      })),
    });
  }
  return assignments;
}

async function fetchGrades(pool: Pool, courseId: number) {
  const { rows } = await pool.query<{
    itemname: string; userid: number; rawgrade: number; finalgrade: number;
  }>(`
    SELECT gi.itemname, gg.userid, gg.rawgrade, gg.finalgrade
    FROM mdl_grade_grades gg
    JOIN mdl_grade_items gi ON gi.id = gg.itemid
    WHERE gi.courseid = $1
  `, [courseId]);
  return rows.map(r => ({
    itemname: r.itemname ?? 'Grade',
    userid: r.userid,
    rawgrade: r.rawgrade ?? undefined,
    finalgrade: r.finalgrade ?? undefined,
  }));
}

async function fetchUsers(pool: Pool, courseId: number) {
  const { rows } = await pool.query<{
    id: number; username: string; email: string; firstname: string; lastname: string;
  }>(`
    SELECT DISTINCT u.id, u.username, u.email, u.firstname, u.lastname
    FROM mdl_user u
    JOIN mdl_user_enrolments ue ON ue.userid = u.id
    JOIN mdl_enrol e ON e.id = ue.enrolid AND e.courseid = $1
    WHERE u.deleted = 0 AND u.id > 1
  `, [courseId]);
  return rows;
}

async function fetchEnrolments(pool: Pool, courseId: number) {
  const { rows } = await pool.query<{ userid: number; roleshortname: string; }>(`
    SELECT ra.userid,
           COALESCE(r.shortname, 'student') AS roleshortname
    FROM mdl_role_assignments ra
    JOIN mdl_context ctx ON ctx.id = ra.contextid AND ctx.instanceid = $1 AND ctx.contextlevel = 50
    LEFT JOIN mdl_role r ON r.id = ra.roleid
  `, [courseId]);
  return rows.map(r => ({ userId: r.userid, roleShortname: r.roleshortname }));
}

function mergeTotals(a: ImportResult, b: ImportResult): ImportResult {
  return {
    courses: a.courses + b.courses,
    sections: a.sections + b.sections,
    modules: a.modules + b.modules,
    users: a.users + b.users,
    enrolments: a.enrolments + b.enrolments,
    forums: a.forums + b.forums,
    threads: a.threads + b.threads,
    posts: a.posts + b.posts,
    assignments: a.assignments + b.assignments,
    submissions: a.submissions + b.submissions,
    grades: a.grades + b.grades,
    warnings: [...a.warnings, ...b.warnings],
  };
}

function printResult(result: ImportResult): void {
  console.log('\n📊 Import summary');
  console.log(`   Courses     : ${result.courses}`);
  console.log(`   Sections    : ${result.sections}`);
  console.log(`   Modules     : ${result.modules}`);
  console.log(`   Users       : ${result.users}`);
  console.log(`   Enrolments  : ${result.enrolments}`);
  console.log(`   Forums      : ${result.forums}`);
  console.log(`   Threads     : ${result.threads}`);
  console.log(`   Posts       : ${result.posts}`);
  console.log(`   Assignments : ${result.assignments}`);
  console.log(`   Submissions : ${result.submissions}`);
  console.log(`   Grades      : ${result.grades}`);
  if (result.warnings.length > 0) {
    console.log(`\n⚠️   Warnings (${result.warnings.length}):`);
    result.warnings.forEach(w => console.log(`   - ${w}`));
  }
  console.log('\n✅  Done.');
}
