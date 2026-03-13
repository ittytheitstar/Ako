# Phase 2 – Courses, Enrolments, Cohorts & Groups

## Goal
Deliver the core **delivery backbone** so learners:
- See the right courses automatically
- Are enrolled reliably via cohorts
- Only see content relevant to their intake

This phase mirrors the proven Moodle patterns already in use (cohort sync, groups, groupings, availability rules) while making them explicit, testable, and API-driven.

---

## Scope & Deliverables

### 1. Course Model
- Course lifecycle: **Draft → Published → (Archived in Phase 4)**
- Entities:
  - Course
  - Sections
  - Modules (activities/resources)
- Metadata:
  - Code, title, description
  - Visibility & published state
  - Term model (semester / term / year)

**Done when** a published course renders sections/modules correctly with availability applied.

---

### 2. Enrolments

#### Enrolment Methods
- Manual enrolment
- Cohort-sync enrolment (primary)

#### Enrolment Fields
- status: active | suspended | completed
- start_at / end_at
- role mapping (student, teacher, read-only)

#### Behaviour
- Cohort membership automatically creates course enrolments
- Withdrawn members are suspended or removed based on policy
- Enrolment drift can be reconciled on demand

---

### 3. Cohorts, Groups & Groupings

#### Cohorts (Global)
- Represent offering/intake codes (e.g. `NZ2992-26-S1`)
- Source of truth for auto-enrolment

#### Course Groups
- One group per cohort per course
- Auto-created by cohort-sync enrolment method (optional flag)

#### Groupings (Critical)
- Groupings = *groups of groups*
- Used for **content restriction**, not raw groups

**Why:** new intakes create new groups; groupings avoid re-editing every restricted item each term.

---

### 4. Availability Rules

Availability is evaluated per user using a strict schema:

```json
{
  "anyOf": [
    { "groupingId": "term-1" },
    { "cohortId": "NZ2992-26-S1" }
  ],
  "allOf": [
    { "roleInCourse": ["student"] }
  ],
  "timeWindow": {
    "start": "2026-02-01",
    "end": "2026-06-30"
  },
  "hideCompletely": true
}
```

Rules apply to:
- Modules
- Sections

---

## API Surface (v1)

### Courses
- GET /courses
- POST /courses
- GET /courses/{id}
- PATCH /courses/{id}
- POST /courses/{id}:publish

### Sections & Modules
- POST /courses/{id}/sections
- POST /courses/{id}/modules
- PATCH /modules/{id}
- POST /modules/{id}:move
- POST /modules/{id}:hide | :show

### Cohorts
- GET /cohorts
- POST /cohorts
- GET /cohorts/{id}/members
- POST /cohorts/{id}/members:bulkAdd
- POST /cohorts/{id}/members:bulkRemove

### Groups & Groupings
- POST /courses/{id}/groups
- POST /courses/{id}/groupings
- POST /groupings/{id}/groups:bulkAdd

### Enrolments
- POST /courses/{id}/enrolments
- PATCH /enrolments/{id}
- DELETE /enrolments/{id}

### Enrolment Methods
- POST /courses/{id}/enrolment-methods
  - type: manual | cohort_sync
  - cohortId
  - defaultRole
  - createGroup (bool)

### Reconciliation (Operationally Required)
- POST /courses/{id}/enrolments:reconcile
- POST /cohorts/{id}/sync:reconcile

---

## Service Logic

### Cohort Sync Worker
1. Listen for cohort member changes
2. Ensure enrolment exists for each member
3. Optionally create/update course group
4. Apply removal/suspension policy
5. Emit audit + domain events

A nightly full-sync acts as a safety net.

---

## UI Expectations

### Learner
- My Courses (active / upcoming)
- Course home filtered by availability

### Teacher
- Course builder (sections/modules)
- Availability editor (grouping-first)
- Grouping manager (add intake → done)

### Admin
- Cohort directory
- Enrolment method configuration
- Reconciliation + reports

---

## Permissions (Minimum)
- course:create / edit / publish
- enrol:manage
- cohort:manage
- group:manage
- availability:edit

---

## Events Emitted
- course.created | updated | published
- section.created | updated | deleted
- module.created | updated | moved | visibilityChanged
- cohort.member.added | removed
- enrolment.created | updated | deleted
- enrolment.reconciled

---

## Acceptance Criteria

1. Adding a user to a cohort enrols them into all linked courses automatically
2. Adding a cohort group to a grouping unlocks all restricted content instantly
3. Reconciliation fixes missing/extra enrolments with a report

---

## Phase 2 Backlog (Order)
1. Course CRUD + publish
2. Sections & modules
3. Availability engine
4. Cohorts & members
5. Groups & groupings
6. Cohort-sync enrolment method
7. Reconciliation jobs
8. Teacher grouping UI
9. Learner My Courses view
10. Audit & metrics
