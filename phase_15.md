# Phase 15 – Placement Tracking

## Goal

Enable **work-integrated learning (WIL) and placement programmes** within Ako by giving students a
structured way to log hours, record task-level activity, write reflective journals, and map their
practical experience to potential grade outcomes.  Supervisors and academic staff gain visibility
into student progress and can approve/sign-off on hours and tasks.

---

## Scope & Deliverables

### 1. Placement Records

A **placement record** captures the core details of a student's placement engagement.

#### Placement Attributes

| Field | Type | Description |
|---|---|---|
| placement_id | UUID PK | |
| tenant_id | UUID FK | |
| course_id | UUID FK | (the course that runs the placement) |
| student_id | UUID FK | |
| supervisor_id | UUID FK | (workplace or academic supervisor) |
| organisation | TEXT | employer/host organisation name |
| role_title | TEXT | student's role during placement |
| location | TEXT | |
| start_date | DATE | |
| end_date | DATE | |
| required_hours | INT | target hours to complete |
| status | TEXT | `pending` \| `active` \| `completed` \| `withdrawn` \| `failed` |
| settings | JSONB | |
| created_by | UUID FK | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### 2. Hour Logs

Students log individual sessions of time spent on placement.

#### Hour Log Attributes

| Field | Type | Description |
|---|---|---|
| log_id | UUID PK | |
| placement_id | UUID FK | |
| tenant_id | UUID FK | |
| student_id | UUID FK | |
| log_date | DATE | |
| hours | NUMERIC(5,2) | hours worked this session |
| description | TEXT | brief description of activities |
| approved | BOOLEAN | supervisor sign-off |
| approved_by | UUID FK | |
| approved_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### Hour Log Computed Fields
- `total_hours_logged` — sum of all approved hour logs for a placement
- `hours_remaining` — `required_hours - total_hours_logged`
- `completion_pct` — `total_hours_logged / required_hours * 100`

---

### 3. Task Logs

Track specific **tasks or competency areas** performed during placement, with counts/instances for
repetitive tasks.

#### Task Log Attributes

| Field | Type | Description |
|---|---|---|
| task_log_id | UUID PK | |
| placement_id | UUID FK | |
| tenant_id | UUID FK | |
| student_id | UUID FK | |
| task_name | TEXT | e.g. "Patient assessment", "Code review" |
| task_category | TEXT | grouping category |
| instances | INT | number of times task was performed |
| hours | NUMERIC(5,2) | time on this task |
| notes | TEXT | |
| log_date | DATE | |
| competency_id | UUID FK (nullable) | link to Phase 13 competency |
| approved | BOOLEAN | |
| approved_by | UUID FK | |
| approved_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### 4. Reflective Journal Entries

Students write structured reflections on their placement experience.

#### Reflection Attributes

| Field | Type | Description |
|---|---|---|
| reflection_id | UUID PK | |
| placement_id | UUID FK | |
| tenant_id | UUID FK | |
| student_id | UUID FK | |
| title | TEXT | |
| body | TEXT | Markdown |
| reflection_type | TEXT | `daily` \| `weekly` \| `critical_incident` \| `final` |
| reflection_date | DATE | |
| visibility | TEXT | `private` \| `supervisor` \| `teacher` \| `all` |
| feedback | TEXT | supervisor/teacher feedback |
| feedback_by | UUID FK | |
| feedback_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### 5. Grade Outcomes

Link placement performance to formal grade items in the gradebook (Phase 9).

#### Placement Grade Link Attributes

| Field | Type | Description |
|---|---|---|
| grade_link_id | UUID PK | |
| placement_id | UUID FK | |
| tenant_id | UUID FK | |
| grade_item_id | UUID FK | gradebook grade item |
| contribution_pct | NUMERIC(5,2) | what % of grade item this placement contributes |
| calculation_method | TEXT | `hours_based` \| `task_based` \| `manual` |
| calculated_grade | NUMERIC(10,2) | computed grade value |
| override_grade | NUMERIC(10,2) | teacher override |
| final_grade | NUMERIC(10,2) | `COALESCE(override_grade, calculated_grade)` |
| notes | TEXT | |
| updated_by | UUID FK | |
| updated_at | TIMESTAMPTZ | |

#### Grade Calculation Methods
- **hours_based**: `(total_approved_hours / required_hours) * max_grade`
- **task_based**: weighted sum of approved task instances against expected targets
- **manual**: teacher enters grade directly

---

## Domain Model Summary

### New Tables
- `placements`
- `placement_hour_logs`
- `placement_task_logs`
- `placement_reflections`
- `placement_grade_links`

---

## API Surface (v1)

### Placements
- `GET /placements` — list (filterable by course_id, student_id, status)
- `POST /placements` — create placement record
- `GET /placements/:id` — detail with summary stats
- `PATCH /placements/:id` — update placement
- `DELETE /placements/:id` — delete placement

### Hour Logs
- `GET /placements/:id/hour-logs` — list hour logs for a placement
- `POST /placements/:id/hour-logs` — create hour log
- `PATCH /placement-hour-logs/:id` — update hour log
- `DELETE /placement-hour-logs/:id` — delete hour log
- `POST /placement-hour-logs/:id/approve` — supervisor/teacher approves log

### Task Logs
- `GET /placements/:id/task-logs` — list task logs
- `POST /placements/:id/task-logs` — create task log
- `PATCH /placement-task-logs/:id` — update task log
- `DELETE /placement-task-logs/:id` — delete task log
- `POST /placement-task-logs/:id/approve` — approve task log

### Reflections
- `GET /placements/:id/reflections` — list reflections (visibility-filtered by role)
- `POST /placements/:id/reflections` — create reflection
- `PATCH /placement-reflections/:id` — update reflection
- `DELETE /placement-reflections/:id` — delete reflection
- `POST /placement-reflections/:id/feedback` — supervisor/teacher adds feedback

### Grade Outcomes
- `GET /placements/:id/grade-links` — list grade links
- `POST /placements/:id/grade-links` — create grade link
- `PATCH /placement-grade-links/:id` — update link
- `DELETE /placement-grade-links/:id` — delete link
- `POST /placements/:id/grade-links/calculate` — recalculate all grades for placement

### Reporting
- `GET /placements/summary` — aggregated summary per course: total students, hours logged, completion %

---

## Service Logic

### Hour Completion Check
After each hour log approval, check if `total_approved_hours >= required_hours`.
If so, emit `placement.hours.completed` and update placement `status` to `completed`
(unless manually overridden).

### Grade Calculation Worker
On `placement.hours.completed` or `POST /placements/:id/grade-links/calculate`:
1. Iterate all `placement_grade_links` for the placement
2. For each link, apply `calculation_method` to derive `calculated_grade`
3. Write to gradebook `grades` table row for the linked `grade_item_id` and `student_id`
4. Emit `placement.grade.calculated`

### Reflection Visibility Rules
| Student Role | Visible Reflections |
|---|---|
| Author (student) | `private`, `supervisor`, `teacher`, `all` |
| Supervisor | `supervisor`, `teacher`, `all` |
| Teacher | `teacher`, `all` |
| Other student | `all` only |

---

## UI Expectations

### Student
- **My Placements** — list of placements, summary stats (hours logged, % complete)
- **Placement Dashboard** — hour log table + add entry, task log table + add entry, reflection journal,
  grade outcome panel
- **Reflection Journal** — write and view entries; see supervisor feedback

### Supervisor / Teacher
- **Placement Overview** — all students in a course, hours summary, pending approvals
- **Approve Hours** — bulk-approve pending hour logs
- **Approve Tasks** — bulk-approve task logs
- **Feedback Panel** — review and respond to reflections
- **Grade Outcomes** — override calculated grades, trigger recalculation

### Admin
- **Placement Admin** — list all placements, generate summary report

---

## Permissions (Minimum)
- `placement:view` — view own placement (student) or course placements (teacher/admin)
- `placement:manage` — create, update, delete placements (teacher+)
- `placement:approve` — approve hour and task logs (supervisor, teacher)
- `placement:grade` — manage grade links and overrides (teacher+)

---

## Events Emitted
- `placement.created`
- `placement.hours.completed`
- `placement.grade.calculated`
- `placement.reflection.submitted`
- `placement.reflection.feedback_given`

---

## Acceptance Criteria

1. A teacher creates a placement record for a student in a course; the student can log hours against it.
2. A supervisor approves an hour log; the placement's `total_hours_logged` and `completion_pct`
   update accordingly.
3. When approved hours reach `required_hours`, the placement status updates to `completed`.
4. A student's reflections marked `private` are not visible to other students but are visible to
   their supervisor.
5. A grade link of type `hours_based` recalculates `calculated_grade` correctly when hours are approved.
6. The course placement overview shows total students, average completion %, and pending approvals.

---

## Phase 15 Backlog (Order)
1. DB migrations (placements, hour_logs, task_logs, reflections, grade_links)
2. Placement CRUD API
3. Hour log CRUD + approve API
4. Task log CRUD + approve API
5. Reflection CRUD + feedback API
6. Grade link CRUD + calculation API
7. Placement summary report endpoint
8. Shared types and SDK methods
9. Student "My Placements" page
10. Student placement dashboard (hours, tasks, reflections, grades)
11. Teacher placement overview + approve UI
12. Grade outcomes UI
13. Admin placement admin page
