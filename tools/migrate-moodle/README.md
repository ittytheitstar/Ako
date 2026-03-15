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
| Forum threads & posts (with thread metadata) | ✅ |
| Assignments & submissions | ✅ |
| Gradebook items & grades | ✅ |
| Gradebook categories & weights | ✅ Phase 9 |
| Question bank categories & questions | ✅ Phase 9 |
| Lessons (pages, question pages) | ✅ Phase 11 |
| Choices (poll options) | ✅ Phase 11 |
| Glossaries & entries | ✅ Phase 11 |
| Wikis & pages | ✅ Phase 11 |
| Files / binary content | ⚙️ Skeleton only (path metadata stored) |
| SCORM packages | ⚙️ Skeleton only |

> **Note:** The full XML parser for Moodle backup archives (`.mbz`) is a TODO stub.
> The import engine and database connectivity are fully scaffolded and exercised by tests.

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

# Dry-run (parse and validate without writing to the database)
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

## Module type mapping

| Moodle `modname` | Ako `module_type` |
|------------------|------------------|
| `page`, `label`, `url`, `book`, `lesson`, `choice`, `glossary`, `wiki` | `page` |
| `resource`, `folder` | `file` |
| `forum`, `chat` | `forum` |
| `assign`, `workshop`, `feedback`, `survey` | `assignment` |
| `quiz` | `quiz` |
| `lti` | `lti` |
| `scorm`, `imscp` | `scorm` |
| anything else | `page` |

Phase 11 activity types (`lesson`, `choice`, `glossary`, `wiki`, `workshop`) are mapped to the
closest core module type and their full activity data is written to the dedicated Phase 11 tables
(`lessons`, `choices`, `choice_options`, `glossary_entries`, `wikis`, `wiki_pages`).

## Environment

No environment variables required. All configuration is passed via CLI flags.

## Extending

The entry points for each import mode are:
- `src/backup-importer.ts` – `.mbz` archive parsing and import
- `src/db-importer.ts` – Moodle database reading
- `src/importer.ts` – `AkoImporter` class that writes to Ako's database
- `src/types.ts` – Intermediate representation types
- `src/importer-helpers.ts` – Pure mapping functions (testable without DB)

To add support for a new Moodle activity type:
1. Add a type to `src/types.ts` and extend `MoodleCourse`
2. Add a fetch function in `src/db-importer.ts`
3. Add an import block in `src/importer.ts` → `AkoImporter.importCourse()`
4. Add the new counter to `emptyResult()` in `src/types.ts`
5. Update `mergeTotals()` and `printResult()` in `src/db-importer.ts`

## Conversion notes

- Moodle uses numeric IDs; Ako uses UUIDs. The importer maps them internally during the import transaction.
- Roles are mapped: `editingteacher`/`teacher` → `teacher`; `student` → `student`; `ta`/`non-editing-teacher` → `ta`; anything else → `student`.
- Timestamps are converted from Unix seconds to `TIMESTAMPTZ`.
- Question types are mapped: `multichoice` → `multiple_choice`; `truefalse` → `true_false`; `shortanswer` → `short_answer`; `essay` → `essay`; `numerical` → `numerical`; unknown → `essay`.
