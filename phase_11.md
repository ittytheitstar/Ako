# Phase 11 – Richer Activity & Content Types

## Goal

Expand Ako's activity library beyond its current core module set to match the most pedagogically
valuable activities found in Moodle's `public/mod` directory.

This phase is based on Phase 7D of the Phase 7 recommendation set. Activities are delivered
incrementally in priority order, keeping module contracts consistent with the Phase 2 course builder.

---

## Priority Order

1. **Lesson** — branching content (highest institutional demand)
2. **Choice / Poll** — quick class feedback
3. **Glossary** — collaborative terminology
4. **Workshop / Peer Review** — structured peer assessment
5. **Wiki** — collaborative authoring
6. **Attendance** — session attendance tracking

---

## Scope & Deliverables

### 1. Lesson (Branching Content)

A Lesson is a sequence of **pages** where each page can present content and/or ask a question. The
learner's answer determines which page they see next (linear or branching).

#### Features
- Page types: `content`, `question`, `end_of_lesson`, `branch_table`
- Question types reuse the question bank (Phase 9) or inline question definitions
- Jump targets: next page, specific page, end, or retry
- Progress through a lesson is tracked as a `lesson_attempt`
- Minimum passing grade configurable
- Re-attempt controls (max_attempts)
- Timer (time_limit_minutes per lesson)

#### Completion Integration (Phase 8)
- completion_type = `submit` (finish the lesson) or `grade` (pass the lesson)

---

### 2. Choice / Poll

A simple single-question poll for quick class feedback.

#### Features
- Multiple options (2–10)
- Limit responses per option (optional)
- Show results: after answering, after closing, never
- Anonymous vs identified responses
- Allow change of response before close_at
- Single select or multiple select

#### Completion Integration
- completion_type = `submit` (cast a vote)

---

### 3. Glossary

A collaborative, course-level term dictionary.

#### Features
- Entries have term, definition, attachments, and author
- Categories (e.g. Week 1 vocabulary)
- Learners can submit entries (teacher-approval workflow optional)
- Teacher can mark entries as approved / rejected
- Auto-link: glossary terms found in course content are hyperlinked (optional, per course)
- Import/export in CSV format
- Search and browse by initial letter

#### Completion Integration
- completion_type = `post` (create at least one approved entry)

---

### 4. Workshop / Peer Review

A two-phase structured peer assessment activity.

#### Phases
1. **Submission phase** — learners submit their work
2. **Assessment phase** — each learner assesses N peers using a configurable rubric
3. **Grading phase** — teacher reviews peer grades and can adjust
4. **Closed** — results released

#### Features
- Configurable number of assessments per learner (peer_count)
- Allocation strategies: random, teacher-assigned
- Assessment forms: rubric-based (phases 4 rubric model) or custom criteria
- Peer assessment grade + submission grade combined via configurable weights
- Self-assessment option

#### Completion Integration
- completion_type = `submit` (complete both submission and required peer assessments)

---

### 5. Wiki

A course-level collaboratively edited wiki.

#### Features
- Individual wiki (each learner has their own private wiki) or collaborative (shared)
- Pages with rich text (TipTap / ProseMirror body JSON)
- Page history / version diffs
- Page linking with `[[Page Name]]` syntax
- Teacher can lock/unlock pages

#### Completion Integration
- completion_type = `post` (create or edit at least one page)

---

### 6. Attendance

Track learner attendance at scheduled sessions.

#### Features
- Sessions linked to `calendar_events` (Phase 10) or created independently
- Attendance statuses: Present, Late, Absent, Excused
- Teacher takes roll (bulk update for a session)
- Learners can self-record for online sessions (with override by teacher)
- Per-learner attendance summary (total / present / absent / late)
- Minimum attendance threshold (linked to completion rules)

#### Completion Integration
- completion_type = `grade` (attendance percentage ≥ threshold)

---

## Domain Model Additions

Each activity type adds a new table plus integration with the existing `course_modules` table
(via `module_type` and `settings` JSONB for lightweight configs, full tables for relational data).

### New Entities

#### Lessons
- `lessons` — lesson definition (module_id FK, time_limit_minutes, max_attempts, passing_grade)
- `lesson_pages` — page definitions (page_type, title, body, jump_target, question JSONB)
- `lesson_attempts` — per-user attempt records with current_page_id, score, started_at, completed_at
- `lesson_attempt_answers` — individual page answers within an attempt

#### Choices
- `choices` — choice definition (module_id FK, close_at, allow_update, show_results, multiple_select)
- `choice_options` — options for a choice (text, max_answers)
- `choice_answers` — learner selections (user_id, option_ids)

#### Glossary
- `glossary_categories` — optional category grouping
- `glossary_entries` — term, definition, author_id, status (pending/approved/rejected), category_id
- `glossary_entry_ratings` — optional ratings/reactions per entry

#### Workshop
- `workshops` — workshop definition (module_id FK, submission_end_at, assessment_end_at, peer_count, weights)
- `workshop_submissions` — learner submissions (similar to assignment_submissions)
- `workshop_assessments` — peer assessments (assessor_id, submission_id, grades JSONB, feedback)

#### Wiki
- `wikis` — wiki definition (module_id FK, wiki_type: individual|collaborative)
- `wiki_pages` — pages (wiki_id, title, body JSONB, version, locked)
- `wiki_page_versions` — immutable version snapshots

#### Attendance
- `attendance_sessions` — sessions (module_id FK, calendar_event_id optional, session_date, description)
- `attendance_records` — per-learner per-session (status: present|late|absent|excused, recorded_by)

---

## API Surface (v1)

### Lessons
- `GET /lessons/:moduleId` — lesson definition
- `PUT /lessons/:moduleId` — create/replace lesson config
- `GET /lessons/:moduleId/pages` — all pages
- `POST /lessons/:moduleId/pages` — create page
- `PUT /lessons/:moduleId/pages/:pageId` — update page
- `POST /lessons/:moduleId/attempts` — start attempt
- `POST /lessons/:moduleId/attempts/:attemptId/answer` — submit page answer (returns next page)
- `POST /lessons/:moduleId/attempts/:attemptId/finish` — complete attempt

### Choices
- `GET /choices/:moduleId` — choice config + options
- `PUT /choices/:moduleId` — create/replace config
- `POST /choices/:moduleId/answers` — submit answer
- `GET /choices/:moduleId/results` — results (respecting show_results setting)

### Glossary
- `GET /glossary/:moduleId/entries` — list entries
- `POST /glossary/:moduleId/entries` — create entry
- `PATCH /glossary/:moduleId/entries/:id` — update / approve / reject
- `DELETE /glossary/:moduleId/entries/:id` — delete
- `GET /glossary/:moduleId/categories` — list categories
- `POST /glossary/:moduleId/import` — CSV import

### Workshop
- `GET /workshops/:moduleId` — definition and current phase
- `PUT /workshops/:moduleId` — configure workshop
- `POST /workshops/:moduleId/submissions` — submit work
- `GET /workshops/:moduleId/assessments` — my assigned peer assessments
- `POST /workshops/:moduleId/assessments/:submissionId` — submit peer assessment
- `POST /workshops/:moduleId/advance` — advance to next phase (teacher)

### Wiki
- `GET /wikis/:moduleId/pages` — list pages
- `POST /wikis/:moduleId/pages` — create page
- `PATCH /wikis/:moduleId/pages/:pageId` — update page (creates new version)
- `GET /wikis/:moduleId/pages/:pageId/history` — version history
- `POST /wikis/:moduleId/pages/:pageId/lock` — lock/unlock

### Attendance
- `GET /attendance/:moduleId/sessions` — list sessions
- `POST /attendance/:moduleId/sessions` — create session
- `GET /attendance/:moduleId/sessions/:sessionId/records` — attendance for a session
- `PUT /attendance/:moduleId/sessions/:sessionId/records` — bulk upsert records (teacher)
- `POST /attendance/:moduleId/sessions/:sessionId/self` — self-report (learner)
- `GET /attendance/:moduleId/summary` — per-learner totals

---

## UI Expectations

### Learner
- **Lesson player** — page-by-page content + question flow with progress indicator
- **Choice** — option select form with result display
- **Glossary** — browse/search with inline definition, submit entry form
- **Workshop** — phase status, submission form, peer assessment form
- **Wiki** — page browser, rich text editor, version history
- **Attendance** — own attendance record view

### Teacher
- **Lesson builder** — drag-and-drop page editor with branching config
- **Choice manager** — option editor, open/close controls, results dashboard
- **Glossary moderation** — pending entry approval queue
- **Workshop control** — phase management, assessment allocation, grade adjustment
- **Wiki administration** — lock/unlock pages, view all page versions
- **Attendance roll** — session manager, bulk attendance entry grid

---

## Permissions (Minimum)
- `lesson:view`, `lesson:attempt`, `lesson:manage`
- `choice:vote`, `choice:manage`, `choice:results`
- `glossary:view`, `glossary:contribute`, `glossary:moderate`
- `workshop:submit`, `workshop:assess`, `workshop:manage`
- `wiki:read`, `wiki:write`, `wiki:manage`
- `attendance:view`, `attendance:record`, `attendance:manage`

---

## Events Emitted
- `lesson.attempt.completed`
- `choice.answer.submitted`
- `glossary.entry.submitted`, `glossary.entry.approved`
- `workshop.submission.submitted`, `workshop.assessment.submitted`
- `wiki.page.created`, `wiki.page.updated`
- `attendance.session.taken`

---

## Acceptance Criteria

1. A lesson with branching pages routes the learner to different pages based on their answers
2. A choice poll closes at `close_at` and displays results to learners (if configured)
3. A glossary entry submitted by a learner appears in a pending queue; on approval it becomes visible
4. A workshop with 3 peers allocated per submission shows each learner 3 assessment tasks
5. A wiki page edit creates a new version; rolling back to v1 is possible
6. An attendance session with 30 learners can be taken via a bulk roll table in under 1 minute

---

## Phase 11 Backlog (Order)
1. DB migrations for all 6 activity types
2. Lesson API + player
3. Choice/Poll API + vote UI
4. Glossary API + moderation
5. Workshop API + phase engine
6. Wiki API + editor
7. Attendance API + roll grid
8. Completion integration for all types
9. Lesson builder UI
10. Workshop peer allocation + assessment UI
11. Attendance summary reports
