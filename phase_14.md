# Phase 14 – Kanban Boards, Issue Tracker & User Stories

## Goal

Provide **class-student-focused project management tooling** baked directly into Ako: Kanban boards
with customisable swim lanes, tight role-based access controls, card archiving and board templating;
a linked issue tracker; and user stories that tie individual student work to collaborative effort at
course and cohort level.

---

## Scope & Deliverables

### 1. Kanban Boards

A **Kanban board** is always owned by a **course** (or optionally a **cohort** within a course) and
is therefore always student-focused.  Boards can be:

- Created manually by teachers/admins
- Spun up in bulk from a **board template** for every enrolled student
- Archived at the end of a class and "refreshed" (cloned to a new board) for the next intake

#### Board Attributes

| Field | Description |
|---|---|
| board_id | UUID PK |
| tenant_id | UUID FK |
| course_id | UUID FK (required) |
| cohort_id | UUID FK (optional, narrows scope to a cohort) |
| owner_user_id | UUID FK – the student or teacher who owns this board |
| title | TEXT |
| description | TEXT |
| template_id | UUID FK (null if not derived from a template) |
| status | `active` \| `archived` |
| settings | JSONB – colour scheme, WIP limits, etc. |
| created_by | UUID FK |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |
| archived_at | TIMESTAMPTZ (null while active) |

#### Access Controls

Access is governed by **board roles** independent of the course role:

| Board Role | Can View | Can Create Cards | Can Move Cards | Can Manage Lanes | Can Archive |
|---|---|---|---|---|---|
| `viewer` | ✓ | | | | |
| `contributor` | ✓ | ✓ | Own cards only | | |
| `member` | ✓ | ✓ | Any card | | |
| `manager` | ✓ | ✓ | Any card | ✓ | ✓ |
| `admin` | ✓ | ✓ | Any card | ✓ | ✓ |

Teachers are automatically granted `manager` on all boards in their courses.  Admins receive `admin`.
Students default to `contributor` on boards where they are listed as `owner_user_id` and `viewer`
on all other boards in the same course unless explicitly elevated.

---

### 2. Swim Lanes

Each board has an ordered list of **lanes** representing workflow stages (e.g. Backlog, In Progress,
Review, Done).

#### Lane Attributes

| Field | Description |
|---|---|
| lane_id | UUID PK |
| board_id | UUID FK |
| tenant_id | UUID FK |
| title | TEXT |
| position | INT |
| color | TEXT (hex colour) |
| wip_limit | INT nullable (0 = unlimited) |
| is_done_lane | BOOLEAN – when a card enters this lane, completion event fires |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

---

### 3. Kanban Cards

A card is the unit of student work.

#### Card Attributes

| Field | Type | Description |
|---|---|---|
| card_id | UUID PK | |
| board_id | UUID FK | |
| lane_id | UUID FK | |
| tenant_id | UUID FK | |
| title | TEXT | |
| description | TEXT | Markdown |
| assignees | UUID[] | User IDs |
| start_date | DATE | |
| end_date | DATE | |
| time_worked_minutes | INT | cumulative |
| tags | TEXT[] | |
| flags | TEXT[] | e.g. 'blocked', 'urgent', 'needs_review' |
| position | INT | sort order within lane |
| priority | TEXT | `low` \| `medium` \| `high` \| `critical` |
| story_points | INT | effort estimate |
| issue_id | UUID FK (nullable) | linked issue |
| user_story_id | UUID FK (nullable) | linked user story |
| archived | BOOLEAN | |
| created_by | UUID FK | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### Card Time Log

| Field | Description |
|---|---|
| time_log_id | UUID PK |
| card_id | UUID FK |
| user_id | UUID FK |
| minutes | INT |
| logged_at | TIMESTAMPTZ |
| note | TEXT |

---

### 4. Board Members

Explicit board membership rows (separate from implicit course-role grants).

| Field | Description |
|---|---|
| member_id | UUID PK |
| board_id | UUID FK |
| user_id | UUID FK |
| board_role | TEXT – `viewer` \| `contributor` \| `member` \| `manager` \| `admin` |
| added_by | UUID FK |
| added_at | TIMESTAMPTZ |

---

### 5. Board Templates

A **board template** captures a lane layout (and optionally seed cards) that can be stamped out
across many students.

| Field | Description |
|---|---|
| template_id | UUID PK |
| tenant_id | UUID FK |
| name | TEXT |
| description | TEXT |
| lane_definitions | JSONB – ordered array of `{title, color, wip_limit, is_done_lane}` |
| seed_cards | JSONB – optional starter cards per lane |
| created_by | UUID FK |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

#### Mass Creation

`POST /board-templates/:id/instantiate` accepts a list of `user_ids` (or a `cohort_id`) and creates
one board per user, all initialised from the template's lane definitions.

#### Refresh (Re-use for New Cohort)

`POST /kanban-boards/:id/refresh` clones the board's lane structure into a new board (blank cards),
targeting a new `course_id` or `cohort_id`, preserving the template lineage.

---

### 6. Issue Tracker

Issues are lightweight work items that can exist independently of a Kanban card but can also be
linked to one.

#### Issue Attributes

| Field | Type | Description |
|---|---|---|
| issue_id | UUID PK | |
| tenant_id | UUID FK | |
| course_id | UUID FK | |
| board_id | UUID FK (nullable) | optional board context |
| title | TEXT | |
| description | TEXT | Markdown |
| type | TEXT | `bug` \| `feature` \| `improvement` \| `task` \| `question` |
| status | TEXT | `open` \| `in_progress` \| `resolved` \| `closed` \| `wont_fix` |
| priority | TEXT | `low` \| `medium` \| `high` \| `critical` |
| reporter_id | UUID FK | |
| assignees | UUID[] | |
| labels | TEXT[] | |
| due_date | DATE | |
| resolved_at | TIMESTAMPTZ | |
| user_story_id | UUID FK (nullable) | parent user story |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### Issue Comments

| Field | Description |
|---|---|
| comment_id | UUID PK |
| issue_id | UUID FK |
| user_id | UUID FK |
| body | TEXT |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

---

### 7. User Stories

User stories provide the collaborative "why" behind cards and issues, connecting student
contributions to shared learning objectives.

#### User Story Attributes

| Field | Type | Description |
|---|---|---|
| story_id | UUID PK | |
| tenant_id | UUID FK | |
| course_id | UUID FK | |
| title | TEXT | Short summary |
| as_a | TEXT | Role/persona |
| i_want | TEXT | Goal |
| so_that | TEXT | Benefit |
| acceptance_criteria | TEXT | Markdown |
| priority | TEXT | `low` \| `medium` \| `high` \| `critical` |
| status | TEXT | `draft` \| `ready` \| `in_progress` \| `done` \| `rejected` |
| story_points | INT | |
| assignees | UUID[] | |
| labels | TEXT[] | |
| competency_id | UUID FK (nullable) | link to Phase 13 competency |
| created_by | UUID FK | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

## Domain Model Summary

### New Tables

- `kanban_boards`
- `kanban_lanes`
- `kanban_cards`
- `kanban_card_time_logs`
- `kanban_board_members`
- `kanban_board_templates`
- `issues`
- `issue_comments`
- `user_stories`

---

## API Surface (v1)

### Kanban Boards
- `GET /kanban-boards` — list boards (filterable by course_id, status, owner)
- `POST /kanban-boards` — create board
- `GET /kanban-boards/:id` — board + lanes + cards
- `PATCH /kanban-boards/:id` — update title/description/settings
- `DELETE /kanban-boards/:id` — soft-delete (archive)
- `POST /kanban-boards/:id/archive` — archive board
- `POST /kanban-boards/:id/refresh` — clone lane structure to a new board

### Lanes
- `GET /kanban-boards/:id/lanes` — ordered lane list
- `POST /kanban-boards/:id/lanes` — add lane
- `PATCH /kanban-lanes/:id` — update lane
- `DELETE /kanban-lanes/:id` — remove lane (must be empty)
- `PUT /kanban-boards/:id/lanes/reorder` — reorder lanes

### Cards
- `GET /kanban-boards/:id/cards` — list all cards on a board
- `POST /kanban-boards/:id/cards` — create card
- `GET /kanban-cards/:id` — card detail
- `PATCH /kanban-cards/:id` — update card (title, desc, assignees, dates, tags, flags)
- `DELETE /kanban-cards/:id` — delete card
- `POST /kanban-cards/:id/move` — move to a different lane (body: `{ lane_id, position }`)
- `POST /kanban-cards/:id/time-log` — log time
- `GET /kanban-cards/:id/time-logs` — list time logs
- `POST /kanban-cards/:id/archive` — archive card

### Board Members
- `GET /kanban-boards/:id/members` — list members
- `POST /kanban-boards/:id/members` — add member
- `PATCH /kanban-board-members/:id` — change role
- `DELETE /kanban-board-members/:id` — remove member

### Board Templates
- `GET /board-templates` — list templates
- `POST /board-templates` — create template
- `GET /board-templates/:id` — template detail
- `PATCH /board-templates/:id` — update template
- `DELETE /board-templates/:id` — delete template
- `POST /board-templates/:id/instantiate` — mass-create boards from template

### Issues
- `GET /issues` — list issues (filterable by course_id, status, type, assignee)
- `POST /issues` — create issue
- `GET /issues/:id` — issue detail with comments
- `PATCH /issues/:id` — update issue
- `DELETE /issues/:id` — delete issue
- `GET /issues/:id/comments` — list comments
- `POST /issues/:id/comments` — add comment
- `PATCH /issue-comments/:id` — update comment
- `DELETE /issue-comments/:id` — delete comment

### User Stories
- `GET /user-stories` — list (filterable by course_id, status, assignee)
- `POST /user-stories` — create
- `GET /user-stories/:id` — detail with linked issues and cards
- `PATCH /user-stories/:id` — update
- `DELETE /user-stories/:id` — delete

---

## Service Logic

### WIP Limit Enforcement
When a card is moved into a lane that has `wip_limit > 0` and the count of non-archived cards
in that lane would exceed the limit, the API returns `422 Unprocessable Entity` with a
`wip_limit_exceeded` error type.  Managers and admins may override using `{ force: true }`.

### Board Completion Event
When a card enters a lane with `is_done_lane = true`, the API emits:
- `kanban.card.completed` (card_id, board_id, course_id, user_ids from assignees)

This event can be consumed by the completion pipeline (Phase 8) to trigger module completion.

### Mass Instantiation Worker
1. Validate template and target user list / cohort
2. For each user: create `kanban_boards` row + clone `kanban_lanes` rows from template
3. Add user as `member` board role
4. Emit `kanban.board.created` per board

---

## UI Expectations

### Student (Learner)
- **My Boards** – list of boards where user is owner or member, grouped by course
- **Board View** – horizontal swim-lane view, drag-and-drop cards, time logging modal, archive button
- **Card Detail Modal** – full attribute editing, assignee picker, time log history, linked issue/story

### Teacher
- **Course Board Overview** – all boards for a course, filter by student
- **Board Template Manager** – create templates, instantiate for class/cohort
- **Issue Tracker** – list/create/triage issues for a course
- **User Story Backlog** – manage user stories and link to cards/issues

### Admin
- **Kanban Admin** – list all boards, archive in bulk, manage templates across tenant

---

## Permissions (Minimum)
- `kanban:view` — view boards (student, teacher, admin)
- `kanban:create` — create a board (teacher+)
- `kanban:manage` — archive, refresh, manage members (teacher+)
- `kanban:admin` — tenant-wide board administration
- `issue:view` — view issues
- `issue:create` — create issues (student+)
- `issue:manage` — triage, close, delete issues (teacher+)
- `story:view` — view user stories
- `story:manage` — create, update, delete user stories (teacher+)

---

## Events Emitted
- `kanban.board.created`
- `kanban.board.archived`
- `kanban.card.created`
- `kanban.card.moved`
- `kanban.card.completed`
- `kanban.card.archived`
- `issue.created`
- `issue.resolved`
- `story.status.changed`

---

## Acceptance Criteria

1. A teacher creates a board template with 4 lanes (Backlog, In Progress, Review, Done) and
   instantiates it for 25 enrolled students; each student sees exactly one new board in their
   "My Boards" list.
2. A student moves a card from "In Progress" to the "Done" lane; a `kanban.card.completed` event
   is emitted and the card's `lane_id` is updated.
3. Moving a card into a lane at its WIP limit without `force: true` returns 422.
4. A teacher archives a board; it disappears from the active board list but is still accessible via
   `?status=archived`.
5. `POST /kanban-boards/:id/refresh` creates a new board with the same lane titles but zero cards.
6. An issue created for a course can be linked to a user story and to a Kanban card.
7. Time logs accumulate on a card and are visible in the card detail.

---

## Phase 14 Backlog (Order)
1. DB migrations (boards, lanes, cards, time_logs, members, templates, issues, comments, stories)
2. Kanban board CRUD + member management API
3. Lane management API (CRUD + reorder)
4. Card CRUD + move + WIP enforcement
5. Card time-log API
6. Board template CRUD + mass instantiate
7. Board archive + refresh
8. Issue tracker CRUD + comments
9. User story CRUD
10. Shared types and SDK methods
11. Student "My Boards" page
12. Board view (swim lanes + cards)
13. Card detail modal
14. Teacher course board overview
15. Board template manager UI
16. Issue tracker UI
17. User story backlog UI
18. Admin Kanban page
