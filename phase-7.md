# Phase 7 – Learning Pathways, Assessment Depth & Academic Operations

## Goal

Close the highest-value capability gaps between **Ako** and **Moodle** so Ako moves from a strong modern LMS foundation to a more **feature-complete institutional learning platform**.

This phase is a **recommendation set for review**, not an approved implementation plan yet.

It is based on:
- Ako's implemented phases and current routes/UI (`phase_2.md`, `phase_3.md`, `phase_4.md`, `Phase_5.md`, `phase_6.md`, plus current API/web code)
- Moodle capability areas visible in the public repository, especially:
  - `public/mod` (broad activity library)
  - `public/grade` (gradebook and grading workflows)
  - `public/calendar` (calendar and subscriptions)
  - `public/backup` (backup / restore)
  - `public/question` (question bank)
  - `public/competency` (competencies / outcomes)

---

## Comparison Snapshot

### Ako already covers well
- Course structure, sections, enrolments, cohorts, groups, groupings, and availability rules
- Forums, messaging, announcements, notifications, and realtime presence
- Core assignments, quizzes, and a basic gradebook
- Archiving, retention, reporting, exports, audit, and governance
- Plugins, webhooks, integrations, automation, feature flags, and developer tooling
- Observability, rate limiting, permission audit, health checks, and alerts

### Moodle capability areas that still add meaningful value
- A much broader **activity and content** library
- **Completion tracking** and conditional learning progression
- Deeper **gradebook**, grading workflow, and question-bank tooling
- **Calendar** and academic scheduling features
- **Competencies / outcomes** tracking
- Mature **backup / restore / course copy / template** workflows

These gaps are the clearest path to making Ako feel more feature complete for real institutional use.

---

## Recommended Phase 7 Scope

### 1. Completion Tracking & Learning Pathways

#### Why it matters
Ako currently reports completion at a course level, but it does not yet appear to provide Moodle-style **activity completion**, **prerequisites**, or **conditional progression**. This is one of the biggest differences between a course delivery platform and a full LMS.

#### Suggested deliverables
- Activity-level completion rules
  - automatic completion (submit assignment, pass quiz, post in forum)
  - manual completion by learner
  - teacher-marked completion where needed
- Course completion criteria
  - required activities
  - minimum grade thresholds
  - required dates / attendance / participation rules
- Conditional release / progression
  - unlock section B only after section A is complete
  - unlock assessments only after prerequisite resources are viewed
  - support "must achieve" vs "should complete" logic
- Learner progress indicators
  - per-course progress bar
  - next required action
  - overdue / blocked states

#### Why this should be first
This adds immediate value for learners and teachers, and it builds directly on Ako's existing course, module, enrolment, and reporting foundations.

---

### 2. Richer Activity & Content Types

#### Why it matters
Moodle's `public/mod` directory shows a broad set of learning activities beyond Ako's current core module set. Ako already has the platform structure to support more module types, so expanding the activity library would add visible product value quickly.

#### Suggested additions
- **Lesson** style branching content
- **Workshop** / peer review workflows
- **Choice / poll** activities for quick class feedback
- **Glossary** for collaborative terminology building
- **Wiki** for collaborative authoring
- **Database / structured entry** activities
- **Book / multi-page content** resources
- **H5P / interactive content** support
- **Attendance** tracking module

#### Recommended approach
- Keep module contracts consistent with the Phase 2 course builder
- Ship these incrementally rather than as one large release
- Prioritize the modules that add the most institutional value first:
  1. lesson
  2. choice / poll
  3. glossary
  4. workshop
  5. wiki
  6. attendance

---

### 3. Advanced Assessment, Question Bank & Gradebook

#### Why it matters
Ako has useful assessment foundations, but Moodle's `public/question` and `public/grade` areas show a much more mature academic model. This is likely the largest remaining gap for serious teaching teams.

#### Suggested deliverables

##### Question bank maturity
- Shared question bank per tenant / course
- Categories, tags, ownership, and reuse controls
- Question versioning
- Import/export support for common formats
- Randomized question selection from categories

##### Quiz and assessment depth
- Attempt controls
  - time limits
  - open / close dates
  - attempt limits
  - review windows
- More grading strategies
  - highest grade
  - average grade
  - latest attempt
  - first attempt
- More question behaviors
  - deferred feedback
  - interactive / immediate feedback modes

##### Gradebook depth
- Grade categories and weighted aggregation
- Grade formulas / calculated columns
- Scale grades, letter grades, pass/fail thresholds
- Grade overrides and locking
- Hidden / released grade states
- Bulk grading and CSV import/export
- Marking workflow and moderation states

#### Outcome
This would make Ako much more credible for courses with formal assessment requirements, moderation, and grade governance.

---

### 4. Calendar, Deadlines & Academic Scheduling

#### Why it matters
Moodle's `public/calendar` area highlights something Ako still lacks as a first-class experience: a unified academic calendar. This is valuable to every user role and improves day-to-day usability immediately.

#### Suggested deliverables
- Unified calendar for:
  - assignment due dates
  - quiz windows
  - course events
  - cohort events
  - system / institutional dates
- Calendar views
  - month / week / agenda
  - learner personal view
  - teacher course view
  - admin institutional view
- Calendar subscriptions / exports
  - iCal feed export
  - external calendar subscription
- Recurring event support
- Deadline reminders and notification hooks

#### Why this adds disproportionate value
It is highly visible, improves planning for learners, and connects naturally to existing notifications, reports, and announcements.

---

### 5. Competencies, Outcomes & Programme-Level Tracking

#### Why it matters
Moodle includes a `public/competency` area for a reason: institutions often need to track more than course completion. Ako would gain significant academic value by supporting outcomes and competency mapping.

#### Suggested deliverables
- Competency frameworks
  - programme outcomes
  - course outcomes
  - competency hierarchies
- Map activities and assessments to competencies
- Evidence collection from assignments, quizzes, and teacher judgments
- Learner competency dashboards
- Programme / faculty reporting for competency attainment

#### Strategic value
This would differentiate Ako beyond "modern Moodle replacement" and make it stronger for vocational, compliance, and outcomes-based education contexts.

---

### 6. Course Templates, Backup / Restore & Course Copy

#### Why it matters
Ako already has archiving and Moodle migration tooling, but Moodle's `public/backup` area shows a more complete operational workflow for course reuse. Teachers and admins need this to run repeated offerings efficiently.

#### Suggested deliverables
- Course template creation
- Course copy / duplicate workflow
- Selective copy options
  - structure only
  - structure + activities
  - include gradebook setup
  - exclude learner data
- Native Ako backup package export
- Native Ako restore workflow
- Better parity for Moodle backup import
  - especially question banks
  - richer activity parsing
  - file / SCORM completeness

#### Why this matters operationally
This reduces setup time every term and complements the existing migration story with day-2 institutional operations.

---

## Recommended Priority Order

### Tier 1 – Highest value, strongest parity gains
1. Completion tracking & learning pathways
2. Advanced assessment / question bank / gradebook
3. Calendar, deadlines & academic scheduling

### Tier 2 – Strong product differentiation
4. Richer activity and content types
5. Course templates, backup / restore, and course copy

### Tier 3 – Strategic institutional maturity
6. Competencies, outcomes, and programme tracking

---

## Proposed Backlog Shape

To keep the work realistic, Phase 7 should probably be delivered in **sub-phases** rather than one large milestone:

1. **Phase 7A – Progression**
   - completion tracking
   - conditional release
   - learner progress UI

2. **Phase 7B – Assessment Depth**
   - question bank
   - advanced quiz controls
   - gradebook categories / formulas / release states

3. **Phase 7C – Academic Operations**
   - calendar
   - course copy / templates
   - backup / restore improvements

4. **Phase 7D – Expanded Learning Activities**
   - lesson, choice, glossary, workshop, wiki, attendance

5. **Phase 7E – Outcomes**
   - competencies
   - programme reporting

---

## Acceptance Criteria for an Approved Phase 7

Phase 7 would be worthwhile if, after delivery:

1. Learners can clearly see **what to do next**, what is complete, and what is blocked
2. Teachers can run real assessment workflows without external gradebook workarounds
3. Institutions can manage academic schedules and deadlines in-platform
4. Courses can be copied, templated, backed up, and restored reliably
5. Ako supports a broader set of pedagogically useful learning activities
6. Programme teams can track outcomes or competencies, not just enrolment states

---

## Summary Recommendation

If the goal is to make Ako feel substantially more **feature complete compared to Moodle**, the best next step is not another infrastructure phase. It is a **learning operations phase** focused on:

- progression,
- assessment depth,
- academic scheduling,
- richer learning activities,
- and course reuse / outcomes.

That combination would add obvious end-user value, close several of Moodle's most important capability gaps, and build naturally on the strong platform foundation already implemented in Phases 1–6.
