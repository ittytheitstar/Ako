# Phase 12 – Course Templates, Backup, Restore & Course Copy

## Goal

Enable **course reuse at institutional scale** by delivering a reliable copy, template, backup,
and restore workflow. This reduces the per-term setup overhead for teachers and admins and
complements the existing Moodle migration tooling with a native Ako backup format.

This phase is based on Phase 7C (course copy/backup portion) and Phase 7E's operational
recommendation from the Phase 7 recommendation set.

---

## Scope & Deliverables

### 1. Course Copy

A teacher or admin copies an existing course to create a new one, optionally selecting which
components to include.

#### Selectable Components
- Course structure (sections + modules) — always included in a copy
- Module content (page bodies, file references)
- Assessment definitions (assignments, quizzes with question pools)
- Gradebook setup (categories, grade items, weights)
- Forum definitions (not posts — that would be learner data)
- Availability rules and completion criteria (Phase 8)
- Calendar events (Phase 10)
- Enrolled cohorts / groups (optional; default: excluded)
- Learner submissions and grades (always excluded by default)

#### Copy Behaviour
- Generates a new course with a configurable `course_code` and `title`
- Sets new course to `draft` status
- Preserves internal cross-references (e.g. a quiz grade item still references the copied quiz)
- Emits `course.copied` event
- Async operation tracked via a `copy_jobs` table (same pattern as `export_jobs`)

---

### 2. Course Templates

A **template** is a special course variant that:
- Is marked `is_template = true` on the `courses` table
- Is not directly enrolled into by learners
- Serves as the source for `Create from template` workflows
- Templates are visible in a dedicated template library

#### Template Features
- Template categories (e.g. "Undergraduate", "Professional Development")
- Template metadata: recommended_for, estimated_duration, tags
- Version tracking: a template can be updated; existing courses derived from it are not affected
- Admin can designate any existing course as a template

---

### 3. Native Ako Backup Package

An Ako backup is a ZIP archive containing:
- `manifest.json` — version, created_at, source_course_id, component list
- `course.json` — course, sections, modules metadata
- `content/` — page body files
- `files/` — uploaded file blobs (optional, can be excluded for portability)
- `assessments/` — assignments, quizzes, question bank exports (QTI XML from Phase 9)
- `gradebook/` — grade categories and items (no grades, no submissions)
- `completion/` — completion rules and criteria (Phase 8)
- `calendar/` — course calendar events (Phase 10)

#### Export
- `POST /courses/:id/backup` — starts an async backup job
- `GET /backup-jobs/:id/status` — poll job status
- `GET /backup-jobs/:id/download` — download the ZIP once complete

#### Import / Restore
- `POST /courses/restore` — upload a backup ZIP to restore into a new course
- `POST /courses/:id/restore` — restore into an existing (empty) course
- Validation: manifest version check, schema compatibility warning
- Restore creates a draft course; teacher must publish

---

### 4. Enhanced Moodle Backup Import

Improve the existing `tools/migrate-moodle` to handle:
- Question bank categories and questions (maps to Phase 9 question bank)
- Richer activity types: lesson, choice, glossary, wiki (maps to Phase 11)
- File attachments and SCORM packages
- Grade book structure (categories, weights)
- Forum posts (previously imported but now includes thread metadata)

---

## Domain Model Additions

### New Entities

#### `copy_jobs`
Async course copy job tracker (similar structure to `export_jobs`).

| Column | Type | Description |
|---|---|---|
| job_id | UUID PK | |
| tenant_id | UUID FK | |
| source_course_id | UUID FK | |
| target_course_id | UUID FK | nullable until job completes |
| options | JSONB | copy component selection |
| status | TEXT | pending \| running \| complete \| failed |
| error_message | TEXT | |
| created_by | UUID FK | |
| created_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |

#### `backup_jobs`
Async backup export tracker.

| Column | Type | Description |
|---|---|---|
| job_id | UUID PK | |
| tenant_id | UUID FK | |
| course_id | UUID FK | |
| options | JSONB | include_files, include_submissions |
| status | TEXT | pending \| running \| complete \| failed |
| file_path | TEXT | storage path once done |
| file_size_bytes | BIGINT | |
| created_by | UUID FK | |
| created_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |

#### `restore_jobs`
Async restore tracker.

#### Course Template Additions to `courses` table
- `is_template BOOLEAN NOT NULL DEFAULT false`
- `template_category TEXT`
- `template_tags TEXT[]`
- `template_description TEXT`

---

## API Surface (v1)

### Course Copy
- `POST /courses/:id/copy` — start async copy job; body: `{ title, course_code, options }`
- `GET /copy-jobs/:id` — job status + progress
- `GET /copy-jobs` — list my copy jobs

### Course Templates
- `GET /course-templates` — list templates (filterable by category, tags)
- `POST /courses/:id/promote-template` — mark a course as a template
- `DELETE /courses/:id/demote-template` — unmark
- `POST /course-templates/:id/create-course` — create a new course from this template (triggers copy)

### Backup & Restore
- `POST /courses/:id/backup` — start backup export
- `GET /backup-jobs/:id` — job status
- `GET /backup-jobs/:id/download` — download package
- `POST /courses/restore` — restore from uploaded backup ZIP (multipart)
- `POST /courses/:id/restore` — restore into existing course

---

## Service Logic

### Copy Worker
1. Load source course: sections, modules, content, assessments, gradebook, completion rules, calendar
2. Create target course row with new IDs
3. Deep-clone each component, rewriting foreign key references to new IDs
4. For files: copy file metadata rows (not file blobs unless deep copy opted in)
5. Update `copy_jobs` status to complete with `target_course_id`
6. Emit `course.copied`

### Backup Worker
1. Gather all components for the course into in-memory structures
2. Stream a ZIP: manifest → course JSON → content files → assessment exports → etc.
3. Store ZIP to object storage (or local disk in dev)
4. Update `backup_jobs` with file path and size

### Restore Worker
1. Upload ZIP to temp storage
2. Parse and validate manifest
3. Create course skeleton from `course.json`
4. Import components in dependency order: content → questions → assessments → gradebook → completion
5. Resolve any file references (warn if missing blobs)
6. Emit `course.restored`

---

## UI Expectations

### Teacher
- **Course actions menu** — "Copy course", "Create from template", "Backup", "Restore"
- **Copy wizard** — component selection checkboxes, target title/code input
- **Template browser** — searchable/filterable gallery
- **Backup/restore status** — job progress with download link

### Admin
- **Template library manager** — promote/demote courses, set categories and tags
- **Backup management** — view all tenant backup jobs, storage usage
- **Restore from backup** — upload form with validation feedback

---

## Permissions (Minimum)
- `course:copy` — copy a course
- `template:view` — browse templates
- `template:manage` — promote/demote templates (admin)
- `backup:create` — create backup
- `backup:restore` — restore from backup (admin)

---

## Events Emitted
- `course.copied`
- `course.template.promoted`
- `course.backup.created`
- `course.restored`

---

## Acceptance Criteria

1. A teacher copies a course with sections, modules, and gradebook setup; the new course has all
   components with new IDs and is in `draft` status
2. A course marked as a template appears in the template library and can be used to create a new course
3. A backup ZIP is produced within 60 seconds for a medium-sized course (50 modules, no file blobs)
4. Restoring that backup into a new course reproduces the structure faithfully
5. The Moodle import tool successfully imports question bank categories from a Moodle backup XML

---

## Phase 12 Backlog (Order)
1. DB migrations (copy_jobs, backup_jobs, restore_jobs, template columns)
2. Course copy worker + API
3. Course template UI (library + promote/demote)
4. Backup worker + export API
5. Restore worker + import API
6. Copy wizard UI
7. Backup/restore status pages
8. Enhanced Moodle import (question bank, activities)
9. SDK methods + shared types
10. Documentation (backup format spec)
