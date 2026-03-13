# Phase 9 – Advanced Assessment, Question Bank & Gradebook Depth

## Goal

Mature Ako's assessment and grading capabilities to a level where formal academic courses,
moderation workflows, and institutional grade governance can be managed entirely within the platform.

This phase is based on Phase 7B of the Phase 7 recommendation set. It builds on the quiz, assignment,
and gradebook foundations from Phase 4 and adds the depth needed for serious teaching teams.

---

## Scope & Deliverables

### 1. Shared Question Bank

#### Organisation
- Questions are owned at **tenant** level (shared across courses) or **course** level (private)
- Question **categories** with hierarchical nesting (mirrors Moodle's question bank categories)
- Tags for cross-category search and filtering
- Ownership tracking (created_by, shared_at, shared_by)

#### Question Versioning
- Every save creates a new version; prior versions are retained read-only
- Quizzes reference a specific version or `latest`
- Version diff view for teachers

#### Import / Export
- Import from QTI 2.1 XML packages
- Export to QTI 2.1 XML
- Import/export to Moodle XML format

#### Reuse Controls
- Mark questions as `draft | published | deprecated`
- Permissions: `questions:view`, `questions:edit`, `questions:share`
- Course-level question pools can pull from tenant bank

---

### 2. Randomised Question Selection

- Quiz settings define **question pools** per section:
  - source_category_id, pick_count, order (random | fixed)
- Each learner attempt draws a unique set (seeded per attempt for reproducibility)
- Teachers can preview the sampling distribution

---

### 3. Quiz & Assessment Controls

#### Attempt Controls
- `time_limit_minutes` — countdown enforced client-side + server-side
- `open_at` / `close_at` — quiz window
- `max_attempts` — how many times a learner may attempt
- `attempt_spacing_minutes` — minimum gap between attempts
- `password` — optional access code

#### Grading Strategies (per quiz)
- `highest` — best attempt counts
- `average` — mean across all attempts
- `latest` — most recent attempt
- `first` — first attempt only

#### Question Behaviour Modes
- `deferred_feedback` — all answers locked, feedback shown after submission
- `interactive` — feedback after each question, retry if wrong
- `immediate_feedback` — feedback after each question, no retry

---

### 4. Gradebook Depth

#### Grade Categories
- Hierarchical categories (e.g. Assessments > Quizzes, Assessments > Assignments)
- Category-level aggregation strategies:
  - weighted mean, simple mean, sum, highest, lowest, mode
- Drop lowest N grades within a category
- Category weight (percentage of total course grade)

#### Grade Types
- Numerical (existing)
- Scale grades (Excellent / Good / Satisfactory / Unsatisfactory)
- Letter grades (A+ / A / B+ / B / … / F) with configurable cutoffs
- Pass/Fail (configurable threshold)

#### Grade Item Enhancements
- `weight` — within-category weighting
- `extra_credit` — marks as bonus, does not count against total
- `hidden` — visible to teachers, hidden from learners until released
- `locked` — no further changes allowed
- `release_at` — date when learners can see their grade

#### Grade Overrides and Locking
- Teacher can override any calculated grade (existing feature, now with audit trail)
- Admin can lock grade items so no further changes are possible
- Bulk grade release (flip `hidden = false` for all items in a category)

#### Bulk Operations
- Bulk grade import via CSV (grade_item_name, username, grade columns)
- Bulk grade export to CSV / XLSX
- Quick grade entry table (spreadsheet-like UI)

#### Marking Workflow
- Marking states: `unmarked | in_progress | ready_for_release | released`
- Moderation role: a second marker can review and confirm a grade
- Marking workflow notifications (new submission, grade ready, moderation requested)

---

## Domain Model Additions

### New Entities

#### `question_categories`
Hierarchical categories for question bank organisation (tenant + course scoped).

#### `questions`
Versioned question definitions with type, body JSONB, answers JSONB, tags.

#### `question_versions`
Immutable version snapshots linked to `questions`.

#### `quiz_question_pools`
Defines random-pick sections for a quiz (source_category_id, pick_count, order, quiz_id).

#### `grade_categories`
Hierarchical category tree per course with aggregation strategy and weight.

#### `grade_scales`
Named scales (e.g. Competency Scale) with ordered levels.

#### `marking_workflow_states`
One row per (grade_item, user) tracking the marking lifecycle.

---

## API Surface (v1)

### Question Bank
- `GET /question-bank/categories` — list categories (tree)
- `POST /question-bank/categories` — create category
- `GET /question-bank/questions` — list questions (filterable by category, tag, status)
- `POST /question-bank/questions` — create question
- `GET /question-bank/questions/:id` — get with version history
- `PUT /question-bank/questions/:id` — create new version
- `DELETE /question-bank/questions/:id` — deprecate question
- `POST /question-bank/import` — import QTI/Moodle XML
- `GET /question-bank/export` — export to QTI XML

### Quiz Enhancements
- `GET /quizzes/:id/pools` — question pool configuration
- `PUT /quizzes/:id/pools` — update pools
- `GET /quizzes/:id/attempts` — all attempts (teacher)
- `GET /quizzes/:id/attempts/me` — my attempts (learner)

### Gradebook Enhancements
- `GET /gradebook/categories` — grade categories for a course
- `POST /gradebook/categories` — create category
- `PATCH /gradebook/categories/:id` — update
- `DELETE /gradebook/categories/:id` — delete
- `GET /gradebook/scales` — list grade scales
- `POST /gradebook/scales` — create scale
- `GET /gradebook/marking-workflow` — list marking states (course-scoped)
- `PATCH /gradebook/marking-workflow/:id` — update marking state
- `POST /gradebook/import` — bulk import grades (CSV)
- `GET /gradebook/export` — export grades (CSV)

---

## UI Expectations

### Teacher
- **Question bank** — category browser, question editor, version history viewer
- **Quiz builder** — pool configuration panel (pick N from category X)
- **Quick grade entry** — spreadsheet-like table with inline editing
- **Grade release panel** — bulk release with preview count
- **Marking workflow** — queue of submissions awaiting marking or moderation

### Learner
- **Quiz attempt** — timer countdown, behaviour-mode-aware question flow
- **My grades** — category tree view with weighted totals

### Admin
- **Question bank permissions** — share controls and ownership
- **Grade scale management** — create institution-wide scales

---

## Permissions (Minimum)
- `questions:view`, `questions:edit`, `questions:share`
- `gradebook:manage`, `gradebook:release`, `gradebook:moderate`
- `quiz:manage`, `quiz:attempt`

---

## Events Emitted
- `question.created`, `question.version.created`, `question.deprecated`
- `quiz.attempt.started`, `quiz.attempt.submitted`, `quiz.attempt.graded`
- `grade.released`, `grade.locked`, `grade.moderated`

---

## Acceptance Criteria

1. A teacher creates a question category, adds 20 questions, and configures a quiz to pick 10 at
   random; each learner attempt uses a different random selection
2. A quiz with `highest` grading strategy shows the best of N attempts in the gradebook
3. Grade categories with weighted aggregation produce a correctly weighted course total
4. Bulk CSV import creates or updates grades and logs each change to the audit trail
5. A grade item marked `hidden` is not visible to learners until a teacher releases it
6. A second marker can confirm a grade, advancing the marking workflow state to `released`

---

## Phase 9 Backlog (Order)
1. Question category and question DB tables + versioning
2. Question bank API routes
3. Quiz pool configuration + randomised draw
4. Quiz attempt controls (time limits, open/close, max attempts)
5. Question behaviour modes
6. Grade categories DB + aggregation engine
7. Grade types (scale, letter, pass/fail)
8. Bulk grade import/export
9. Marking workflow engine
10. Question bank UI (browser + editor)
11. Quiz builder pool panel
12. Quick grade entry table
13. Grade release UI
14. Marking workflow queue
