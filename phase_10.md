# Phase 10 – Calendar, Deadlines & Academic Scheduling

## Goal

Give every user role a **unified academic calendar** that surfaces assignment due dates, quiz windows,
course events, and institutional dates in one coherent view. This closes a visibility gap that affects
day-to-day usability for learners, teachers, and administrators alike.

This phase is based on Phase 7C (calendar portion) of the Phase 7 recommendation set.

---

## Scope & Deliverables

### 1. Calendar Event Model

#### Event Sources (automatic)
- Assignment due dates (`due_at` from `assignments`)
- Quiz open/close windows (`open_at` / `close_at` from `quizzes`)
- Course start and end dates (from `courses` + `terms`)
- Announcement scheduled publish dates

#### Event Sources (manual / explicit)
- Course events (teacher-created: lectures, labs, office hours)
- Cohort events (cohort coordinator-created: intake dates, orientation)
- System / institutional dates (admin-created: holidays, enrolment deadlines)

#### Event Fields
- `title`, `description`
- `start_at`, `end_at` (TIMESTAMPTZ)
- `all_day` (boolean)
- `recurrence_rule` (RFC 5545 RRULE string; see Recurring Events below)
- `context_type` / `context_id` — course, cohort, or system
- `source_type` / `source_id` — links back to the originating record (assignment, quiz, etc.)
- `visibility` — public (all enrolled), grouping-scoped, or private

---

### 2. Calendar Views

#### Views
- **Month** — grid view, colour-coded by event type
- **Week** — time-blocked weekly view
- **Agenda** — chronological list view

#### Scope Filters
- **Learner personal view** — all my courses, deadlines, and cohort events
- **Teacher course view** — all events for a specific course
- **Admin institutional view** — tenant-wide calendar with all source types

#### Colour Coding
- Assignments: amber
- Quizzes: blue
- Course events: green
- Cohort events: purple
- System/institutional: gray

---

### 3. Recurring Events

- Use RFC 5545 RRULE syntax for recurrence rules (FREQ, INTERVAL, BYDAY, UNTIL, COUNT)
- Supported frequencies: DAILY, WEEKLY, MONTHLY
- Exception dates (EXDATE) to skip individual occurrences
- Virtual expansion: recurring events are stored as one row with an RRULE, not N rows
- Frontend expands recurrences for the visible date range using an rrule library
- Editing supports "this occurrence only", "this and following", or "all occurrences"

---

### 4. Calendar Subscriptions & Exports

#### iCal Feed Export
- `/api/v1/calendar/ical?token=...` — personal iCal feed (personal token-authenticated)
- `/api/v1/calendar/courses/:courseId/ical` — course calendar feed (auth-protected)
- Includes: event title, description, start/end, URL back to Ako

#### External Calendar Subscription
- Admins can configure external iCal URLs to import (read-only, synced periodically)
- Imported events are stored as `external_calendar_events` and shown in the institutional view

---

### 5. Deadline Reminders

- Configurable reminder intervals: 1 week, 3 days, 1 day, 1 hour before due
- Reminder delivery via existing notification system (in-app + email)
- Per-user preferences: opt in/out of reminders per event type
- Teachers can set course-level default reminder settings

---

## Domain Model Additions

### New Entities

#### `calendar_events`
| Column | Type | Description |
|---|---|---|
| event_id | UUID PK | |
| tenant_id | UUID FK | |
| title | TEXT | |
| description | TEXT | |
| start_at | TIMESTAMPTZ | |
| end_at | TIMESTAMPTZ | |
| all_day | BOOLEAN | |
| recurrence_rule | TEXT | RFC 5545 RRULE |
| recurrence_exceptions | TIMESTAMPTZ[] | EXDATE list |
| context_type | TEXT | course \| cohort \| system |
| context_id | UUID | |
| source_type | TEXT | assignment \| quiz \| manual |
| source_id | UUID | |
| visibility | TEXT | public \| grouping \| private |
| grouping_id | UUID FK | scoped visibility |
| created_by | UUID FK | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `calendar_reminder_prefs`
Per-user, per-event-type reminder preferences.

#### `external_calendar_sources`
External iCal feed URLs configured by admins for import.

#### `external_calendar_events`
Events imported from external iCal sources (read-only, periodically refreshed).

---

## API Surface (v1)

### Calendar Events
- `GET /calendar/events` — list events (filterable by range, context, type)
- `POST /calendar/events` — create manual event
- `GET /calendar/events/:id` — get event detail
- `PATCH /calendar/events/:id` — update (single / following / all for recurring)
- `DELETE /calendar/events/:id` — delete (same recurrence scope options)

### Course & Cohort Calendar
- `GET /courses/:id/calendar` — course events (includes deadline-sourced events)
- `GET /cohorts/:id/calendar` — cohort events

### iCal Feeds
- `GET /calendar/ical` — personal iCal feed (token param)
- `GET /courses/:id/calendar/ical` — course iCal feed

### External Sources (Admin)
- `GET /calendar/external-sources` — list configured sources
- `POST /calendar/external-sources` — add source
- `DELETE /calendar/external-sources/:id` — remove source
- `POST /calendar/external-sources/:id/sync` — force re-sync

### Reminder Preferences
- `GET /calendar/reminder-prefs` — my preferences
- `PUT /calendar/reminder-prefs` — update preferences

---

## Service Logic

### Auto-Event Sync
- When an assignment `due_at` is set or changed, upsert a `calendar_events` row
  (source_type=assignment, source_id=assignment_id)
- When a quiz open/close window changes, upsert similarly
- When a course term changes, upsert course start/end events
- Triggered by domain events: `assignment.updated`, `quiz.updated`, `term.updated`

### Reminder Worker
- Runs every 15 minutes
- Queries `calendar_events` for events whose `start_at - now()` falls within a reminder window
- Checks `calendar_reminder_prefs` for opted-in users
- Emits notifications via the existing notification system
- Deduplicates using a `calendar_reminder_log` table (keyed on event_id + user_id + window)

### iCal Feed Generator
- On-demand generation (no caching required for small tenants)
- Expands recurring events for the next 12 months
- Signed token in URL (HMAC of user_id + tenant_id + expiry)

### External Source Sync Worker
- Polls external iCal URLs on a configurable schedule (default: hourly)
- Stores raw events in `external_calendar_events`
- Deduplicates on UID from the iCal VEVENT

---

## UI Expectations

### Learner
- **Calendar page** — personal calendar with month/week/agenda views
- **Dashboard widget** — upcoming events in the next 7 days
- **Course home** — course-scoped upcoming deadlines sidebar
- **Reminder preferences** — opt in/out per event type

### Teacher
- **Course calendar** — create/edit/delete course events
- **Deadline visibility** — assignment and quiz windows shown on calendar
- **Event form** — title, date/time, recurrence, visibility (all enrolled vs grouping)

### Admin
- **Institutional calendar** — tenant-wide view
- **External sources manager** — add/remove iCal feed URLs
- **Calendar export** — download full institutional calendar

---

## Permissions (Minimum)
- `calendar:view` — view calendar events relevant to me
- `calendar:create` — create manual events (teacher+)
- `calendar:manage` — manage all events for a context (teacher/admin)
- `calendar:admin` — manage external sources and institutional events (admin)

---

## Events Emitted
- `calendar.event.created`
- `calendar.event.updated`
- `calendar.event.deleted`
- `calendar.reminder.sent`

---

## Acceptance Criteria

1. After setting a due date on an assignment, the due date appears on the learner's personal calendar
2. A teacher creates a weekly lecture event with an RRULE; it shows on all future week-view pages
3. A learner receives an in-app notification 1 day before an assignment due date (if opted in)
4. Subscribing the personal iCal feed URL to an external calendar client shows all relevant events
5. An admin adds an external iCal source; its events appear in the institutional calendar within 1 hour
6. Deleting "this occurrence only" removes one instance of a recurring event without affecting others

---

## Phase 10 Backlog (Order)
1. DB migration (calendar_events, reminder_prefs, external sources)
2. Auto-event sync service (assignment / quiz / term domain event handlers)
3. Calendar events REST API
4. iCal feed generator
5. Reminder worker + notification integration
6. External iCal source sync worker
7. Shared types + SDK methods
8. Learner calendar page (month/week/agenda views)
9. Dashboard upcoming events widget
10. Course calendar sidebar (deadline list)
11. Teacher event creation form (with recurrence)
12. Admin institutional calendar + external sources UI
13. Reminder preference settings page
