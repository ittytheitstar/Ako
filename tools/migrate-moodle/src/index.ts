#!/usr/bin/env node
/**
 * migrate-moodle – CLI entry point
 *
 * Imports Moodle backup archives or direct DB extracts into an Ako LMS database.
 *
 * Usage:
 *   migrate-moodle backup   --file <backup.mbz>  --db <postgres-url>
 *   migrate-moodle database --source-db <moodle-pg-url> --db <ako-pg-url>
 */
import { Command } from 'commander';
import { runBackupImport } from './backup-importer';
import { runDatabaseImport } from './db-importer';

const program = new Command();

program
  .name('migrate-moodle')
  .description('Import Moodle content into Ako LMS')
  .version('0.1.0');

program
  .command('backup')
  .description('Import a Moodle .mbz backup archive')
  .requiredOption('-f, --file <path>', 'Path to the Moodle .mbz backup file')
  .requiredOption('-d, --db <url>', 'Ako PostgreSQL connection URL')
  .option('--tenant-id <id>', 'Target tenant UUID (defaults to first tenant)')
  .option('--import-users', 'Also import user accounts', false)
  .option('--dry-run', 'Parse and validate without writing to the database', false)
  .action(async (opts) => {
    await runBackupImport({
      filePath: opts.file,
      akoDbUrl: opts.db,
      tenantId: opts.tenantId,
      importUsers: opts.importUsers,
      dryRun: opts.dryRun,
    });
  });

program
  .command('database')
  .description('Import directly from a Moodle PostgreSQL or MySQL database')
  .requiredOption('-s, --source-db <url>', 'Moodle source DB connection URL')
  .requiredOption('-d, --db <url>', 'Ako PostgreSQL connection URL')
  .option('--tenant-id <id>', 'Target tenant UUID (defaults to first tenant)')
  .option('--import-users', 'Also import user accounts', false)
  .option('--dry-run', 'Parse and validate without writing to the database', false)
  .action(async (opts) => {
    await runDatabaseImport({
      sourceDbUrl: opts.sourceDb,
      akoDbUrl: opts.db,
      tenantId: opts.tenantId,
      importUsers: opts.importUsers,
      dryRun: opts.dryRun,
    });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
