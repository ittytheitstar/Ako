import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { BackupImportOptions, ImportResult, emptyResult } from './types';
import { AkoImporter } from './importer';

/**
 * Imports a Moodle .mbz backup archive into an Ako database.
 *
 * A Moodle .mbz file is a renamed .tar.gz containing:
 *   moodle_backup.xml  – course structure, sections, modules, enrolments
 *   files/             – course files
 *   activities/        – per-module XML files (forum, assign, quiz, …)
 *   users.xml          – user accounts (optional)
 *   grade_items.xml    – gradebook items
 *
 * NOTE: Full PHP-encoded format parsing is out of scope; this skeleton
 * demonstrates the integration points and provides stubs for each data type.
 */
export async function runBackupImport(opts: BackupImportOptions): Promise<void> {
  console.log(`\n📦 Moodle backup import`);
  console.log(`   Source  : ${opts.filePath}`);
  console.log(`   Target  : ${opts.akoDbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`   Dry-run : ${opts.dryRun ? 'yes' : 'no'}\n`);

  if (!existsSync(opts.filePath)) {
    console.error(`❌  File not found: ${opts.filePath}`);
    process.exit(1);
  }

  // Extract the archive to a temp directory
  const workDir = join(tmpdir(), `ako-migrate-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });

  try {
    await extractMbz(opts.filePath, workDir);
    const pool = new Pool({ connectionString: opts.akoDbUrl });

    try {
      const importer = new AkoImporter(pool, opts.tenantId, opts.dryRun);
      const moodleCourse = await parseMoodleBackup(workDir, opts.importUsers);
      const result = await importer.importCourse(moodleCourse);
      printResult(result);
    } finally {
      await pool.end();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌  Import failed: ${message}`);
    process.exit(1);
  }
}

/**
 * Extract a .mbz (tar.gz) archive.
 * Uses the system `tar` command; falls back to a pure-JS stub message.
 */
async function extractMbz(filePath: string, destDir: string): Promise<void> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  try {
    await execFileAsync('tar', ['-xzf', filePath, '-C', destDir]);
    console.log(`✅  Archive extracted to ${destDir}`);
  } catch {
    // tar not available – proceed with a warning (useful in test environments)
    console.warn(`⚠️   Could not extract archive (tar unavailable). Proceeding with empty course stub.`);
  }
}

/**
 * Parse the extracted Moodle backup XML files into an intermediate representation.
 *
 * TODO: Implement full moodle_backup.xml + activity XML parsing.
 *       The structure is documented at:
 *       https://docs.moodle.org/dev/Backup_2.0_for_developers
 */
async function parseMoodleBackup(workDir: string, _importUsers: boolean) {
  const { readFile } = await import('fs/promises');
  const backupXmlPath = join(workDir, 'moodle_backup.xml');

  let rawXml: string | null = null;
  try {
    rawXml = await readFile(backupXmlPath, 'utf8');
  } catch {
    console.warn(`⚠️   moodle_backup.xml not found – using empty course stub.`);
  }

  if (rawXml) {
    // TODO: Use xml2js to parse the full backup structure.
    // const xml2js = await import('xml2js');
    // const parsed = await xml2js.parseStringPromise(rawXml);
    // … map parsed structure to MoodleCourse …
    console.log(`ℹ️   moodle_backup.xml found (${rawXml.length} bytes) – full XML parsing is a TODO.`);
  }

  // Return a stub course so the importer skeleton can be exercised end-to-end.
  return {
    id: 1,
    shortname: 'IMPORTED-001',
    fullname: 'Imported Moodle Course',
    summary: 'Imported via migrate-moodle tool',
    visible: true,
    sections: [{ id: 1, number: 0, name: 'General', visible: true }],
    modules: [],
    users: [],
    enrolments: [],
    forums: [],
    assignments: [],
    grades: [],
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
