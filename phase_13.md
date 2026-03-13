# Phase 13 – Competencies, Outcomes & Programme-Level Tracking

## Goal

Give institutions a structured way to define **learning outcomes and competency frameworks** at the
programme or tenant level, map them to courses and activities, collect evidence, and report on learner
attainment across a programme of study.

This phase is based on Phase 7E of the Phase 7 recommendation set and the strategic recommendation
about outcomes-based and vocational education contexts.

---

## Scope & Deliverables

### 1. Competency Frameworks

A **competency framework** is a hierarchical tree of outcomes defined at the tenant (institution) level.
Frameworks can represent:
- Programme-level graduate attributes
- Course learning outcomes
- Unit standards (vocational)
- Professional body competencies

#### Framework Structure
- `frameworks` — top-level container (name, version, source, description)
- `competencies` — individual competencies within a framework (hierarchical via `parent_id`)
- Each competency has a `short_name`, `description`, `level` (depth in hierarchy), and `idnumber`
  (for integration with external standards databases)

#### Framework Sources
- Manual (created by admin or faculty)
- Import from CSV (competency, parent, description columns)
- Import from CASE JSON (IMS Global Competencies and Academic Standards Exchange)

---

### 2. Mapping Competencies to Courses and Activities

#### Course-Level Mapping
- A course can reference a set of competencies it covers (`course_competency_links`)
- Each link has a `proficiency_expectation`: introduced | developing | demonstrated | mastered

#### Activity-Level Mapping
- Individual modules (assignments, quizzes, lessons) can be tagged to one or more competencies
- Links stored in `activity_competency_links`
- Used to identify which activities provide evidence for a competency

---

### 3. Evidence Collection & Proficiency Ratings

#### Evidence Sources
- **Assignment submission + grade** — automatic evidence when grade meets threshold
- **Quiz pass** — automatic evidence on `complete_pass` state (Phase 8)
- **Teacher judgment** — teacher explicitly rates a learner's proficiency on a competency
- **Portfolio upload** — learner submits a file as direct evidence

#### Proficiency Scale
- Configured per tenant or per framework
- Default scale: `not_yet | beginning | developing | proficient | advanced`
- Evidence records carry a `proficiency_rating` and a `rating_source`

#### Evidence Aggregation
- Ako aggregates multiple evidence items per (learner, competency) using a configurable strategy:
  - `latest` — most recent evidence rating
  - `highest` — best rating achieved
  - `average` — mean rating (rounded)
  - `manual` — teacher's explicit rating overrides aggregated evidence

---

### 4. Learner Competency Dashboard

#### Per-Learner View
- A visual competency tree showing current proficiency for each mapped competency
- Colour-coded states: not_yet (grey), beginning (red), developing (amber), proficient (green), advanced (teal)
- Drill-down to see which activities contributed evidence
- Export: learner competency transcript (PDF or CSV)

#### Teacher View
- Per-course competency coverage matrix: learners x competencies
- Identify learners below threshold for a competency
- Quick proficiency rating entry

---

### 5. Programme-Level Reporting

#### Programme Definition
A **programme** is a configured grouping of courses.

| Field | Description |
|---|---|
| programme_id | UUID PK |
| tenant_id | UUID FK |
| name | e.g. "Bachelor of Applied Technology" |
| code | e.g. "BAT" |
| framework_id | UUID FK to competency_frameworks |
| course_ids | UUID[] courses that form this programme |
| settings | JSONB |

#### Programme Reports
- Competency attainment rates per cohort (% of learners reaching each level)
- Cross-course evidence map (which competencies are covered in which courses)
- Learner transcript generator: all competency evidence across the programme
- Gap analysis: competencies with insufficient coverage across the programme

---

## Domain Model Additions

### New Entities

#### `competency_frameworks`
| Column | Type | Description |
|---|---|---|
| framework_id | UUID PK | |
| tenant_id | UUID FK | |
| name | TEXT | |
| version | TEXT | |
| source | TEXT | manual, csv, case |
| description | TEXT | |
| created_by | UUID FK | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `competencies`
| Column | Type | Description |
|---|---|---|
| competency_id | UUID PK | |
| framework_id | UUID FK | |
| tenant_id | UUID FK | |
| parent_id | UUID FK self-ref | nullable root nodes |
| short_name | TEXT | |
| description | TEXT | |
| idnumber | TEXT | external identifier |
| level | INT | depth in tree |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `course_competency_links`
Links a course to a competency with a proficiency expectation.

#### `activity_competency_links`
Links a module to one or more competencies.

#### `competency_evidence`
| Column | Type | Description |
|---|---|---|
| evidence_id | UUID PK | |
| tenant_id | UUID FK | |
| competency_id | UUID FK | |
| user_id | UUID FK | |
| course_id | UUID FK | |
| source_type | TEXT | assignment, quiz, teacher_judgment, portfolio |
| source_id | UUID | |
| proficiency_rating | TEXT | not_yet, beginning, developing, proficient, advanced |
| rating_source | TEXT | automatic, teacher |
| evidence_date | DATE | |
| notes | TEXT | |
| created_by | UUID FK | |
| created_at | TIMESTAMPTZ | |

#### `competency_profiles`
Aggregated proficiency per (user, competency) for fast querying.

#### `programmes`
Programme definitions as described above.

#### `programme_competency_reports`
Pre-computed report snapshots (refreshed nightly or on demand).

---

## API Surface (v1)

### Competency Frameworks
- `GET /competency-frameworks` — list frameworks
- `POST /competency-frameworks` — create framework
- `GET /competency-frameworks/:id` — get with competency tree
- `PATCH /competency-frameworks/:id` — update metadata
- `DELETE /competency-frameworks/:id` — delete if no linked evidence
- `POST /competency-frameworks/:id/import` — import CSV or CASE JSON
- `GET /competency-frameworks/:id/export` — export CSV

### Competencies
- `GET /competency-frameworks/:frameworkId/competencies` — list (tree or flat)
- `POST /competency-frameworks/:frameworkId/competencies` — create
- `PATCH /competencies/:id` — update
- `DELETE /competencies/:id` — delete leaf node only

### Course & Activity Mapping
- `GET /courses/:id/competencies` — list mapped competencies
- `PUT /courses/:id/competencies` — replace mapping
- `GET /modules/:id/competencies` — module competency links
- `PUT /modules/:id/competencies` — replace module mapping

### Evidence
- `GET /competency-evidence` — list evidence (filterable by user, competency, course)
- `POST /competency-evidence` — record teacher judgment
- `GET /users/:id/competency-profile` — aggregated profile for a learner
- `GET /users/:id/competency-transcript` — full evidence list for transcript

### Programmes
- `GET /programmes` — list
- `POST /programmes` — create
- `GET /programmes/:id` — get with course list
- `PATCH /programmes/:id` — update
- `GET /programmes/:id/report` — attainment report
- `POST /programmes/:id/report/refresh` — refresh cached report

---

## Service Logic

### Automatic Evidence Collection
1. Listen for `completion.activity.completed` events
2. Look up `activity_competency_links` for the completed module
3. For each linked competency, determine proficiency rating from grade percentage or pass/fail state
4. Write to `competency_evidence`
5. Recalculate `competency_profiles` row for (user_id, competency_id) using configured strategy

### Programme Report Generator
1. Triggered nightly or on demand
2. For each programme, iterate learners enrolled in all programme courses
3. Aggregate competency evidence across all courses in the programme
4. Write summary rows to `programme_competency_reports`
5. Emit `programme.report.refreshed`

---

## UI Expectations

### Learner
- **My Competencies page** — visual tree with proficiency indicators, evidence drill-down
- **Transcript download** — PDF or CSV export of competency evidence

### Teacher
- **Course competency settings** — map course to framework, set proficiency expectations
- **Module competency tags** — tag individual modules to competencies
- **Learner competency matrix** — course x competency heat-map with drill-down
- **Quick rating panel** — give teacher judgments inline

### Admin / Faculty
- **Framework manager** — create/edit frameworks, import/export
- **Programme builder** — define programmes and their course membership
- **Programme attainment report** — cohort-level competency dashboard

---

## Permissions (Minimum)
- `competency:view` — see competency frameworks and own profile
- `competency:manage` — create and edit frameworks (admin+)
- `competency:map` — map competencies to courses/modules (teacher+)
- `competency:rate` — give teacher judgments (teacher+)
- `programme:view` — view programme reports (faculty/admin)
- `programme:manage` — create and manage programmes (admin)

---

## Events Emitted
- `competency.evidence.recorded`
- `competency.profile.updated`
- `programme.report.refreshed`

---

## Acceptance Criteria

1. An admin creates a competency framework with 3 levels of hierarchy and imports 20 competencies
2. A teacher maps a course to 5 competencies and tags 3 quiz modules to 2 competencies each
3. When a learner passes a tagged quiz, an evidence record is automatically created and their
   competency profile is updated
4. A teacher can manually rate a learner's proficiency on a competency, overriding automatic evidence
5. A learner's competency dashboard shows colour-coded attainment across all their mapped competencies
6. A programme report shows the percentage of learners who reached `proficient` or above for each
   competency in the programme

---

## Phase 13 Backlog (Order)
1. DB migrations (frameworks, competencies, links, evidence, profiles, programmes, reports)
2. Competency framework CRUD API
3. Course and module mapping API
4. Automatic evidence collection pipeline
5. Proficiency aggregation engine
6. Programme definition API
7. Programme report generator
8. Shared types and SDK methods
9. Framework manager UI
10. Course competency settings UI
11. Module competency tags UI
12. Learner competency dashboard
13. Teacher learner competency matrix
14. Programme builder and attainment report UI
15. Transcript export (CSV)
