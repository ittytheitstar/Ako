import { Pool, PoolClient } from 'pg';
import {
  MoodleCourse, MoodleUser, ImportResult, emptyResult,
} from './types';
import { mapModuleType, mapRole } from './importer-helpers';

/**
 * Writes a parsed Moodle course into the Ako PostgreSQL database.
 *
 * Role mapping:
 *   Moodle "editingteacher" | "teacher"  →  Ako "teacher"
 *   Moodle "student"                     →  Ako "student"
 *   Moodle "ta" | "non-editing-teacher"  →  Ako "ta"
 *   anything else                        →  Ako "student"
 */
export class AkoImporter {
  private pool: Pool;
  private tenantId?: string;
  private dryRun: boolean;

  constructor(pool: Pool, tenantId: string | undefined, dryRun: boolean) {
    this.pool = pool;
    this.tenantId = tenantId;
    this.dryRun = dryRun;
  }

  async importCourse(course: MoodleCourse): Promise<ImportResult> {
    const result = emptyResult();

    const tenantId = await this.resolveTenantId();
    if (!tenantId) {
      result.warnings.push('No tenant found in Ako database. Skipping import.');
      return result;
    }

    console.log(`\n  Importing course: ${course.shortname} – ${course.fullname}`);

    if (this.dryRun) {
      console.log('  [dry-run] Would create course + sections/modules/users/enrolments.');
      result.courses = 1;
      result.sections = course.sections.length;
      result.modules = course.modules.length;
      result.users = (course.users ?? []).length;
      result.enrolments = (course.enrolments ?? []).length;
      result.forums = (course.forums ?? []).length;
      result.assignments = (course.assignments ?? []).length;
      return result;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // ── Course ────────────────────────────────────────────────────────────
      const { rows: courseRows } = await client.query(
        `INSERT INTO courses (tenant_id, course_code, title, description, visibility)
         VALUES ($1, $2, $3, $4, 'tenant')
         ON CONFLICT (tenant_id, course_code) DO UPDATE
           SET title = EXCLUDED.title,
               description = EXCLUDED.description,
               updated_at = now()
         RETURNING course_id`,
        [tenantId, course.shortname, course.fullname, course.summary ?? null]
      );
      const courseId: string = courseRows[0].course_id;
      result.courses = 1;

      // ── Sections ──────────────────────────────────────────────────────────
      const sectionIdMap = new Map<number, string>();
      for (const section of course.sections) {
        const { rows: secRows } = await client.query(
          `INSERT INTO course_sections (tenant_id, course_id, title, position, summary)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (course_id, position) DO UPDATE
             SET title = EXCLUDED.title, summary = EXCLUDED.summary
           RETURNING section_id`,
          [tenantId, courseId, section.name ?? `Section ${section.number}`, section.number, section.summary ?? null]
        );
        sectionIdMap.set(section.id, secRows[0].section_id);
        result.sections++;
      }

      // ── Modules ───────────────────────────────────────────────────────────
      for (const mod of course.modules) {
        const sectionId = sectionIdMap.get(mod.sectionId);
        const moduleType = mapModuleType(mod.modname);
        await client.query(
          `INSERT INTO course_modules (tenant_id, course_id, section_id, module_type, title, settings)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [tenantId, courseId, sectionId ?? null, moduleType, mod.name, JSON.stringify(mod.settings ?? {})]
        );
        result.modules++;
      }

      // ── Users ─────────────────────────────────────────────────────────────
      const userIdMap = new Map<number, string>();
      for (const mUser of (course.users ?? [])) {
        const akoUserId = await this.upsertUser(client, tenantId, mUser);
        userIdMap.set(mUser.id, akoUserId);
        result.users++;
      }

      // ── Enrolments ────────────────────────────────────────────────────────
      for (const enrolment of (course.enrolments ?? [])) {
        const akoUserId = userIdMap.get(enrolment.userId);
        if (!akoUserId) {
          result.warnings.push(`User ${enrolment.userId} not found for enrolment`);
          continue;
        }
        const role = mapRole(enrolment.roleShortname);
        await client.query(
          `INSERT INTO enrolments (tenant_id, course_id, user_id, role, status)
           VALUES ($1, $2, $3, $4, 'active')
           ON CONFLICT (tenant_id, course_id, user_id) DO NOTHING`,
          [tenantId, courseId, akoUserId, role]
        );
        result.enrolments++;
      }

      // ── Forums ────────────────────────────────────────────────────────────
      for (const forum of (course.forums ?? [])) {
        const { rows: forumRows } = await client.query(
          `INSERT INTO forums (tenant_id, course_id, title)
           VALUES ($1, $2, $3)
           RETURNING forum_id`,
          [tenantId, courseId, forum.name]
        );
        const forumId: string = forumRows[0].forum_id;
        result.forums++;

        for (const thread of forum.threads) {
          const authorId = userIdMap.get(thread.userid);
          if (!authorId) {
            result.warnings.push(`Thread author ${thread.userid} not found`);
            continue;
          }
          const { rows: threadRows } = await client.query(
            `INSERT INTO forum_threads (tenant_id, forum_id, title, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING thread_id`,
            [tenantId, forumId, thread.name, authorId]
          );
          const threadId: string = threadRows[0].thread_id;
          result.threads++;

          const postIdMap = new Map<number, string>();
          for (const post of thread.posts) {
            const postAuthorId = userIdMap.get(post.userid);
            if (!postAuthorId) continue;
            const parentPostId = post.parentid ? postIdMap.get(post.parentid) ?? null : null;
            const { rows: postRows } = await client.query(
              `INSERT INTO forum_posts (tenant_id, thread_id, parent_post_id, author_id, body, created_at)
               VALUES ($1, $2, $3, $4, $5, to_timestamp($6))
               RETURNING post_id`,
              [tenantId, threadId, parentPostId, postAuthorId,
               JSON.stringify({ html: post.message }), post.created]
            );
            postIdMap.set(post.id, postRows[0].post_id);
            result.posts++;
          }
        }
      }

      // ── Assignments ───────────────────────────────────────────────────────
      for (const assignment of (course.assignments ?? [])) {
        // Find or create a module for this assignment
        const { rows: modRows } = await client.query(
          `INSERT INTO course_modules (tenant_id, course_id, module_type, title)
           VALUES ($1, $2, 'assignment', $3)
           RETURNING module_id`,
          [tenantId, courseId, assignment.name]
        );
        const moduleId: string = modRows[0].module_id;

        const { rows: assignRows } = await client.query(
          `INSERT INTO assignments (tenant_id, module_id, due_at, max_grade)
           VALUES ($1, $2, ${assignment.duedate ? 'to_timestamp($3)' : 'NULL'}, $${assignment.duedate ? 4 : 3})
           RETURNING assignment_id`,
          assignment.duedate
            ? [tenantId, moduleId, assignment.duedate, assignment.maxgrade]
            : [tenantId, moduleId, assignment.maxgrade]
        );
        const assignmentId: string = assignRows[0].assignment_id;
        result.assignments++;

        for (const sub of assignment.submissions) {
          const subUserId = userIdMap.get(sub.userid);
          if (!subUserId) continue;
          await client.query(
            `INSERT INTO assignment_submissions (tenant_id, assignment_id, user_id, status, body, submitted_at)
             VALUES ($1, $2, $3, $4, $5, to_timestamp($6))
             ON CONFLICT (assignment_id, user_id) DO NOTHING`,
            [tenantId, assignmentId, subUserId,
             sub.status === 'submitted' ? 'submitted' : 'draft',
             JSON.stringify({ text: sub.onlinetext ?? '' }), sub.timemodified]
          );
          result.submissions++;
        }
      }

      // ── Grades ────────────────────────────────────────────────────────────
      for (const grade of (course.grades ?? [])) {
        const gradeUserId = userIdMap.get(grade.userid);
        if (!gradeUserId) continue;

        // Upsert grade item
        const { rows: itemRows } = await client.query(
          `INSERT INTO grade_items (tenant_id, course_id, source_type, name, max_grade)
           VALUES ($1, $2, 'manual', $3, 100)
           ON CONFLICT DO NOTHING
           RETURNING item_id`,
          [tenantId, courseId, grade.itemname]
        );
        if (itemRows.length === 0) continue;
        const itemId: string = itemRows[0].item_id;

        await client.query(
          `INSERT INTO grades (tenant_id, item_id, user_id, grade)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (item_id, user_id) DO UPDATE SET grade = EXCLUDED.grade`,
          [tenantId, itemId, gradeUserId, grade.finalgrade ?? grade.rawgrade ?? null]
        );
        result.grades++;
      }

      await client.query('COMMIT');
      console.log(`  ✅  Course imported: ${course.shortname}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return result;
  }

  private async upsertUser(client: PoolClient, tenantId: string, user: MoodleUser): Promise<string> {
    const email = user.email || `${user.username}@imported.local`;
    const { rows } = await client.query(
      `INSERT INTO users (tenant_id, username, email, display_name, given_name, family_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, email) DO UPDATE
         SET given_name = EXCLUDED.given_name, family_name = EXCLUDED.family_name,
             updated_at = now()
       RETURNING user_id`,
      [tenantId, user.username || email.split('@')[0], email,
       `${user.firstname} ${user.lastname}`.trim(),
       user.firstname || null, user.lastname || null]
    );
    return rows[0].user_id;
  }

  private async resolveTenantId(): Promise<string | null> {
    if (this.tenantId) return this.tenantId;
    const { rows } = await this.pool.query(`SELECT tenant_id FROM tenants ORDER BY created_at LIMIT 1`);
    return rows.length > 0 ? rows[0].tenant_id : null;
  }
}
