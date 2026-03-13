# Phase 3 – Communication, Collaboration & Realtime

## Goal
Deliver **learner–teacher communication and collaboration** features so courses are not just visible and accessible, but *alive*.

Phase 3 introduces:
- Asynchronous discussion (forums)
- Direct and contextual messaging
- Announcements and notifications
- Realtime events (presence, typing, updates)

This phase deliberately builds on Phase 2 enrolments, cohorts, groups, and availability rules.

---

## Scope & Deliverables

### 1. Forums & Discussions

#### Forum Types
- Course-wide forums (announcements, general discussion)
- Group-restricted forums (per cohort/intake)
- Module-level forums (attached to a section/module)

#### Core Features
- Threads → posts → replies
- Rich text + attachments
- Read/unread tracking
- Pinning & locking threads
- Availability rules (grouping-first)

**Done when** a teacher can create a forum restricted to a grouping and only that intake can see/post.

---

### 2. Messaging

#### Messaging Modes
- Direct (1:1)
- Group (course group or grouping)
- Contextual (linked to course, forum, or module)

#### Behaviour
- Users can only message others they share:
  - a course enrolment with, or
  - a cohort/group with
- Messaging respects enrolment status (suspended users are read-only)

#### Features
- Read receipts
- Typing indicators (realtime)
- File attachments

---

### 3. Announcements

#### Announcement Channels
- Course announcements (broadcast)
- Cohort announcements
- System announcements (admin)

#### Behaviour
- Announcements are read-only for learners
- Can be scheduled
- Automatically notify enrolled users

---

### 4. Notifications

#### Notification Types
- New forum post / reply
- Mention (@user, @group)
- Announcement
- Enrolment changes

#### Delivery Channels
- In-app
- Email (configurable per user)
- Push (future)

User preferences determine channel + frequency.

---

### 5. Realtime & Presence

#### Realtime Events
- New message
- New forum post
- Typing started / stopped
- Presence (online / offline / idle)

#### Transport
- WebSocket or SSE (server-sent events)
- Token-authenticated
- Scoped by user + course

Phase 3 does **not** require full collaborative editing — only signalling and updates.

---

## Domain Model

### New Entities
- forums
- forum_threads
- forum_posts
- messages
- conversations
- announcements
- notifications
- presence_sessions

### Key Fields
- visibility / availability (reuse Phase 2 rules)
- context (courseId, moduleId, forumId)
- createdBy, createdAt

---

## API Surface (v1)

### Forums
- POST /courses/{id}/forums
- GET /forums/{id}
- POST /forums/{id}/threads
- POST /threads/{id}/posts
- PATCH /posts/{id}
- POST /threads/{id}:lock | :unlock

### Messaging
- POST /conversations
- GET /conversations
- POST /conversations/{id}/messages

### Announcements
- POST /courses/{id}/announcements
- GET /courses/{id}/announcements

### Notifications
- GET /notifications
- POST /notifications/{id}:ack

### Realtime
- GET /realtime/connect
- GET /realtime/events

---

## Service Logic

### Permission Enforcement
- Forum visibility enforced via availability rules
- Posting requires active enrolment
- Announcements bypass reply permissions

### Notification Pipeline
1. Event emitted (forum post, message, announcement)
2. Notification fan-out service resolves recipients
3. Delivery per user preferences
4. Realtime push where applicable

---

## UI Expectations

### Learner
- Course discussions tab
- Unified inbox
- Notification bell
- Presence indicators

### Teacher
- Forum moderation tools
- Announcement composer
- Group-targeted messaging

### Admin
- Announcement broadcast
- Moderation and audit views

---

## Permissions (Minimum)
- forum:create / moderate
- post:create / edit / delete
- message:send
- announcement:create
- notification:manage

---

## Events Emitted
- forum.created
- thread.created
- post.created | updated | deleted
- message.sent
- announcement.published
- notification.created | delivered
- presence.updated

---

## Acceptance Criteria

1. Learners only see forums and messages for courses/intakes they belong to
2. Posting a forum reply generates notifications and realtime updates
3. Announcements reach all targeted users reliably

---

## Phase 3 Backlog (Order)
1. Forum domain + APIs
2. Forum UI + availability integration
3. Messaging domain + inbox
4. Notification service
5. Realtime transport
6. Presence indicators
7. Moderation tools
8. Preferences UI
9. Audit & abuse controls
10. Performance tuning
