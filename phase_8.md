# Phase 8 – Completion Tracking & Learning Pathways

## Goal

Deliver **activity-level completion tracking** and **conditional content release** so learners always
know what to do next and teachers can design structured, progressive learning experiences.

This phase closes one of the most significant capability gaps between Ako and Moodle: the absence of
a first-class progression model. Without it Ako is a content delivery platform; with it, it becomes
a full learning management system.

Phase 8 builds directly on the course, module, enrolment, and reporting foundations from Phases 1–4.

---

## Scope & Deliverables

### 1. Activity Completion Rules

#### Completion Trigger Types
- **view** – mark complete when the learner first views the module
- **submit** – mark complete when the learner submits an assignment or quiz attempt
- **grade** – mark complete when a passing grade is recorded (configurable threshold)
- **post** – mark complete when the learner posts in the linked forum
- **manual** – learner ticks a checkbox themselves
- **teacher** – teacher marks the learner complete

#### Rule Fields
- `completion_type`: the trigger type above
- `passing_grade`: minimum grade (0–100) for type=grade
- `require_view`: boolean — must the module also be viewed?
- `expected_completion_date`: optional target date for the learner (not a hard deadline)

**Done when** a teacher can configure completion rules per module and those rules are enforced when
evaluating completion states.

---

### 2. Activity Completion States

#### State Values
- `incomplete` — default; no qualifying activity yet
- `complete` — all configured rules satisfied
- `complete_pass` — complete AND the grade met the passing threshold
- `complete_fail` — complete BUT grade was below the threshold

#### State Tracking
- One row per `(module_id, user_id)` pair
- `completed_at` timestamp when state transitions to complete
- `completion_source`: which rule triggered the transition (view, submit, grade, post, manual, teacher)
- `overridden_by`: teacher override support

---

### 3. Course Completion Criteria

Teachers configure what a learner must achieve to complete the entire course:

- **Required activities** — a set of module_ids that must all be complete
- **Required grade aggregate** — a minimum grade average across selected grade items
- **Required date** — the learner must remain enrolled past a given date
- **All activities** — shorthand: every tracked module must be complete

Multiple criteria can be combined (all must be satisfied).

**Done when** a course with configured criteria correctly marks learners as course-complete when all
criteria are met.

---

### 4. Conditional Release / Prerequisite Rules

Teachers can gate access to sections and modules behind completion conditions:

- `require_module_complete`: unlock this item after module X is complete
- `require_course_complete`: unlock after another course is completed (cross-course pathways)
- `require_grade`: unlock after achieving a minimum grade on a specific grade item
- `require_date`: unlock at or after a specific date (existing availability rules already handle this)

Conditional release gates are evaluated in the availability engine and integrated with the existing
`availability` JSONB column on `course_modules` and `course_sections`.

---

### 5. Learner Progress Indicators

#### Per-Course Progress
- Overall completion percentage (modules complete / total tracked modules)
- Count of complete / incomplete / failed activities
- Estimated remaining effort (sum of `expected_completion_date` gaps)

#### Status Labels
- **On track** — progressing normally
- **Overdue** — expected_completion_dates missed
- **Blocked** — prerequisite not yet met
- **Complete** — all criteria satisfied

#### Views
- Progress bar on the course home page
- Per-section completion indicators
- "Next required action" card on the learner dashboard

---

## Domain Model Additions

### New Entities

#### `activity_completion_rules`
| Column | Type | Description |
|---|---|---|
| rule_id | UUID PK | |
| tenant_id | UUID FK | |
| module_id | UUID FK → course_modules | |
| completion_type | TEXT | view \| submit \| grade \| post \| manual \| teacher |
| passing_grade | NUMERIC | threshold for type=grade |
| require_view | BOOLEAN | |
| expected_completion_date | DATE | target date hint |
| created_by | UUID FK | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `activity_completion_states`
| Column | Type | Description |
|---|---|---|
| state_id | UUID PK | |
| tenant_id | UUID FK | |
| module_id | UUID FK | |
| user_id | UUID FK | |
| state | TEXT | incomplete \| complete \| complete_pass \| complete_fail |
| completed_at | TIMESTAMPTZ | |
| completion_source | TEXT | rule type that triggered |
| overridden_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| UNIQUE (module_id, user_id) | | |

#### `course_completion_criteria`
| Column | Type | Description |
|---|---|---|
| criterion_id | UUID PK | |
| tenant_id | UUID FK | |
| course_id | UUID FK | |
| criterion_type | TEXT | required_modules \| min_grade \| required_date \| all_modules |
| settings | JSONB | {module_ids, grade_item_ids, min_grade, required_date, …} |
| created_by | UUID FK | |
| created_at | TIMESTAMPTZ | |

#### `course_completion_states`
| Column | Type | Description |
|---|---|---|
| ccs_id | UUID PK | |
| tenant_id | UUID FK | |
| course_id | UUID FK | |
| user_id | UUID FK | |
| state | TEXT | incomplete \| in_progress \| complete |
| completed_at | TIMESTAMPTZ | |
| progress_pct | NUMERIC | 0–100 |
| last_evaluated_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| UNIQUE (course_id, user_id) | | |

---

## API Surface (v1)

### Activity Completion Rules
- `GET /completion/modules/:moduleId/rules` — get completion rule for a module
- `PUT /completion/modules/:moduleId/rules` — create or replace completion rule
- `DELETE /completion/modules/:moduleId/rules` — remove completion rule (module becomes untracked)

### Activity Completion States
- `GET /completion/modules/:moduleId/states` — list states for all enrolled users (teacher)
- `GET /completion/modules/:moduleId/states/me` — get my state for this module
- `POST /completion/modules/:moduleId/complete` — manual completion trigger (learner or teacher)
- `DELETE /completion/modules/:moduleId/complete` — undo manual completion (teacher only)

### Course Completion Criteria
- `GET /completion/courses/:courseId/criteria` — list criteria for a course
- `POST /completion/courses/:courseId/criteria` — add a criterion
- `DELETE /completion/courses/:courseId/criteria/:criterionId` — remove a criterion

### Course Progress
- `GET /completion/courses/:courseId/progress` — my progress summary (learner)
- `GET /completion/courses/:courseId/summary` — all learner progress (teacher/admin)
- `POST /completion/courses/:courseId/evaluate` — trigger a synchronous evaluation (admin/teacher)

---

## Service Logic

### Completion Evaluation Pipeline
1. A domain event is received: `module.viewed`, `submission.submitted`, `grade.recorded`,
   `forum.post.created`, `completion.manual`
2. The completion worker looks up the `activity_completion_rules` for that module
3. It evaluates whether all rule conditions are now satisfied for the user
4. If satisfied: upsert `activity_completion_states` → state = complete/complete_pass/complete_fail
5. Re-evaluate all `course_completion_criteria` for courses that contain this module
6. If all criteria satisfied: upsert `course_completion_states` → state = complete
7. Emit `completion.activity.completed` and/or `completion.course.completed` events
8. Trigger notifications for course completion

### Conditional Release Check
- Existing `availability` JSONB on modules/sections is extended with a `completionRequired` key:
  ```json
  { "completionRequired": { "moduleId": "...", "state": "complete" } }
  ```
- The availability engine (called when listing/rendering modules) checks this against
  `activity_completion_states` for the requesting user

---

## UI Expectations

### Learner
- **Course home** — progress bar, per-activity completion checkboxes (manual), blocked indicators
- **Dashboard** — "Continue Learning" section with next required action per course
- **Course progress page** — detailed view of all activities and their completion state

### Teacher
- **Module settings panel** — completion rule editor (type, passing grade, expected date)
- **Course completion settings** — criteria builder
- **Learner progress table** — sortable list of all learners with completion %, status, last activity

### Admin
- **Completion reports** — course-wide and tenant-wide completion statistics
- **Bulk completion operations** — reset completions, override for a cohort

---

## Permissions (Minimum)
- `completion:view` — read own completion state
- `completion:manage` — configure rules and criteria (teacher+)
- `completion:override` — override a learner's completion state (teacher+)
- `completion:report` — view all learner states for a course (teacher+)

---

## Events Emitted
- `completion.activity.completed`
- `completion.activity.failed`
- `completion.activity.reset`
- `completion.course.completed`
- `completion.course.reset`

---

## Acceptance Criteria

1. A teacher configures a module with `completion_type = submit`; after a learner submits,
   the module shows as complete for that learner only
2. A teacher sets `completion_type = grade` with `passing_grade = 60`; a learner receiving 55
   gets `complete_fail`, one receiving 65 gets `complete_pass`
3. A manual completion module shows a checkbox to the learner; ticking it marks it complete
4. A section with `completionRequired` in availability is hidden until the prerequisite is met
5. A course with `all_modules` criterion marks the learner as course-complete when every
   tracked module is done
6. A learner's course home page shows an accurate progress bar (X of Y activities complete)

---

## Phase 8 Backlog (Order)
1. DB migration (activity_completion_rules, states, course criteria, course states)
2. Completion evaluation service logic
3. REST API routes
4. Conditional release extension to availability engine
5. Shared types + SDK methods
6. Learner progress bar on course home
7. Activity completion checkboxes (manual type)
8. Course progress detail page
9. Teacher completion rule editor
10. Teacher learner progress table
11. Course completion criteria builder
12. Dashboard "Continue Learning" widget
13. Completion notifications
14. Bulk admin operations
