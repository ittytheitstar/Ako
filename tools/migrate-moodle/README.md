# migrate-moodle

A CLI tool for migrating Moodle content into Ako LMS.

## Overview

This tool supports two import modes:

1. **Backup import** – reads a Moodle `.mbz` backup archive
2. **Database import** – reads directly from a Moodle PostgreSQL or MySQL database

Both modes produce equivalent output in the Ako database.

## What gets imported

| Data type | Status |
|-----------|--------|
| Courses | ✅ |
| Sections | ✅ |
| Modules (pages, forums, assignments, quizzes, resources) | ✅ |
| Users (optional, `--import-users`) | ✅ |
| Enrolments | ✅ |
| Forum threads & posts | ✅ |
| Assignments & submissions | ✅ |
| Gradebook items & grades | ✅ |
| Files / binary content | ⚙️ Skeleton only |
| SCORM packages | ⚙️ Skeleton only |
| Quiz question banks | ⚙️ Skeleton only |

> **Note:** The full XML parser for Moodle backup archives is a TODO stub.
> The import engine and database connectivity are fully scaffolded.

## Usage

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Import from a backup archive
node dist/index.js backup \
  --file /path/to/backup.mbz \
  --db postgresql://ako:ako@localhost:5432/ako \
  --import-users

# Dry-run (no writes)
node dist/index.js backup \
  --file /path/to/backup.mbz \
  --db postgresql://ako:ako@localhost:5432/ako \
  --dry-run

# Import from a Moodle PostgreSQL database
node dist/index.js database \
  --source-db postgresql://moodle:moodle@moodle-db:5432/moodle \
  --db postgresql://ako:ako@localhost:5432/ako \
  --import-users
```

## Environment

No environment variables required. All configuration is passed via CLI flags.

## Extending

The entry points for each import mode are:
- `src/backup-importer.ts` – `.mbz` archive parsing and import
- `src/db-importer.ts` – Moodle database reading
- `src/importer.ts` – `AkoImporter` class that writes to Ako's database
- `src/types.ts` – Intermediate representation types

To add support for a new Moodle activity type:
1. Add a type to `src/types.ts`
2. Add a fetch function in `src/db-importer.ts`
3. Add an import block in `src/importer.ts` → `AkoImporter.importCourse()`

## Conversion notes

- Moodle uses numeric IDs; Ako uses UUIDs. The importer maps them internally.
- Roles are mapped: `editingteacher`/`teacher` → `teacher`; `student` → `student`; `ta` → `ta`.
- Module types are mapped: `assign` → `assignment`; `resource` → `file`; unknown → `page`.
- Timestamps are converted from Unix seconds to `TIMESTAMPTZ`.
