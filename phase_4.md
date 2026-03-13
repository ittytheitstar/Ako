# Phase 4 – Archiving, Records, Analytics & Governance

## Goal
Stabilise the platform for **long‑term institutional use** by adding:
- Course archiving and lifecycle management
- Records retention & compliance controls
- Reporting and analytics
- Operational governance, safety nets, and admin tooling

Phase 4 turns the system from a delivery platform into an **enterprise‑grade academic system of record**.

---

## Scope & Deliverables

### 1. Course Archiving & Lifecycle

#### Course States
- Draft
- Published (active delivery)
- Completed (teaching finished, access retained)
- Archived (read‑only, long‑term access)
- Deleted (policy‑controlled, rare)

#### Archiving Behaviour
- Archive triggered by:
  - Course end date
  - Cohort end date
  - Manual admin action
- Archived courses:
  - Become read‑only for learners
  - Retain submissions, grades, feedback, discussions
  - Remain visible in learner history

**Done when** a course can be archived automatically without data loss.

---

### 2. Records Retention & Compliance

#### Retention Policies
- Configurable by:
  - Course type
  - Programme
  - Regulatory requirement
- Policies define:
  - Retention duration
  - Access level during retention
  - Final disposal action

#### Compliance Features
- Legal hold (prevent deletion)
- Audit trails for:
  - Access
  - Changes
  - Exports
- Export packages (ZIP / WORM‑friendly)

---

### 3. Reporting & Analytics

#### Core Reports
- Enrolments by course / cohort
- Activity participation
- Forum engagement
- Completion & progression

#### Data Characteristics
- Read‑only analytics store
- Time‑series friendly
- No impact on live performance

#### Access
- Teacher dashboards (course‑scoped)
- Programme / faculty dashboards
- Admin & institutional views

---

### 4. Data Export & Integration

#### Export Types
- Course archive export
- Assessment evidence export
- Engagement metrics export

#### Integration Patterns
- Scheduled exports
- Event‑driven feeds
- Secure, scoped access tokens

Phase 4 does not add *new* learning features — it hardens data movement.

---

### 5. Governance & Admin Tooling

#### Admin Capabilities
- Course lifecycle override
- Re‑archive / restore course
- Cohort end‑date correction
- Bulk operations

#### Safeguards
- Dry‑run mode for destructive actions
- Mandatory confirmations
- Role‑based restrictions

---

## Domain Model Additions

### New Entities
- course_archives
- retention_policies
- audit_events
- analytics_snapshots
- export_jobs

### Key Fields
- policyId
- retentionUntil
- archivedAt
- immutableFlags

---

## API Surface (v1)

### Archiving
- POST /courses/{id}:archive
- POST /courses/{id}:restore
- GET /courses/{id}/archive

### Retention & Compliance
- POST /retention-policies
- GET /retention-policies
- POST /courses/{id}:legal-hold

### Reporting
- GET /reports/enrolments
- GET /reports/activity
- GET /reports/completion

### Exports
- POST /courses/{id}/exports
- GET /exports/{id}/status
- GET /exports/{id}/download

### Audit
- GET /audit/events

---

## Service Logic

### Archival Worker
1. Identify courses eligible for archive
2. Snapshot course state
3. Transition permissions to read‑only
4. Emit archive events
5. Verify integrity

### Analytics Pipeline
- Consume domain events
- Aggregate into analytics store
- Power dashboards and reports

---

## UI Expectations

### Learner
- Past courses view
- Read‑only access to archived material

### Teacher
- Historical course access
- Evidence export tools

### Admin
- Archive scheduler
- Retention policy editor
- Compliance dashboard

---

## Permissions (Minimum)
- archive:execute
- archive:restore
- retention:manage
- report:view
- audit:view

---

## Events Emitted
- course.archived
- course.restored
- retention.applied
- export.started | completed | failed
- audit.logged

---

## Acceptance Criteria

1. Courses archive automatically based on configured rules
2. Archived courses remain accessible and immutable
3. Reports do not impact live system performance
4. All sensitive actions are auditable

---

## Phase 4 Backlog (Order)
1. Archival domain + worker
2. Read‑only permission model
3. Retention policy engine
4. Audit log service
5. Analytics pipeline
6. Reporting UI
7. Export tooling
8. Admin governance UI
9. Compliance validation
10. Documentation & runbooks
