# GitHub Copilot / Copilot Chat Mega-Prompt: Build "Ako" (a modern Moodle-class LMS) from scratch

You are acting as a **senior principal engineer + product architect**. Your task is to generate a full, working codebase for **Ako**, a modern, scalable LMS inspired by Moodle, using the machine-readable specs under `spec/`.

## 0) Golden rules
1. **Read the spec files first**: `spec/ako.product.json`, `spec/ako.api.json`, `spec/ako.db.json`. Treat them as authoritative.
2. Build an **API-first, modular monorepo** with clear boundaries.
3. Implement a **full REST API** in a separate container from the UI.
4. Implement **real-time updates** (WebSocket + fallback SSE) with event-driven architecture.
5. Implement **OIDC SSO**, **LTI 1.3 Advantage**, and **SCIM 2.0** provisioning.
6. Provide **PostgreSQL DB creation scripts** (already scaffolded under `db/`), migrations, and seeds.
7. Ensure performance and scalability (stateless services, caching, queues, pagination).
8. Keep it **offline-friendly**: no external CDN dependencies required for core operation.
9. Favor security by default: RBAC/ABAC, audit logging, rate limits, input validation.

## 1) Tech stack (choose and justify)
Use modern, widely-supported, high-performance technologies:
- **Frontend**: React (Next.js App Router) + TypeScript + TanStack Query + WebSocket client + component library.
- **Backend** (REST services): TypeScript + Fastify (or NestJS with Fastify adapter) + Zod for validation.
- **Realtime gateway**: Node + uWebSockets.js OR Fastify websocket plugin, backed by NATS.
- **Persistence**: PostgreSQL 16; Redis for cache/session/rate-limit; NATS for event bus.
- **Search** (phase 2): Postgres full-text first; optional OpenSearch/Elastic later.
- **Observability**: OpenTelemetry + Prometheus metrics endpoints.

If you pick alternatives (Go/Rust), keep API contracts and folder structure consistent.

## 2) Repository layout (monorepo)
Create:
- `apps/web` (Next.js)
- `services/api` (REST gateway + BFF; routes mounted at /api/v1)
- `services/realtime` (WS/SSE gateway)
- `services/lti` (optional separate service) OR a module inside api
- `services/scim` (optional separate service) OR a module inside api
- `packages/shared` (types, OpenAPI schema, utilities)
- `packages/ui` (shared UI components)
- `packages/sdk` (typed client SDK)
- `db/` (migrations, seeds) already exists
- `infra/` (docker, k8s manifests, helm charts)

Use `pnpm` workspaces.

## 3) Core domain model (must implement)
Based on Moodle-like feature needs:
- Tenancy: `tenants`
- Identity: users, identities (OIDC/SAML), sessions
- Roles/Permissions: RBAC + scoped roles (tenant/course/group)
- Courses: categories, courses, sections, modules
- Content: pages, files, embeds, SCORM packages (store metadata; player integration)
- Enrolments: manual, cohort-based, group-based
- Cohorts/Groups: plus groupings
- Assessments:
  - Assignments: submissions, plagiarism hooks, rubrics, feedback
  - Quizzes: question bank, attempts, grading strategies
- Gradebook: grade items, grades, overrides/locks, exports
- Forums: threads/posts, moderation, inline replies
- Messaging: 1:1 teacher-student, cohort chats, course chats
- Reactions: emoji-style, **visible only to cohort** or DM scope
- Notifications: in-app + email hooks
- Reporting: engagement, completion, exports
- Audit log + outbox events

## 4) API design requirements
1. Follow `spec/ako.api.json` for base paths and style.
2. Use consistent patterns:
   - `GET /resource?cursor=...` for pagination
   - `POST /resource` create
   - `GET /resource/{id}`
   - `PATCH /resource/{id}` partial update
   - `DELETE /resource/{id}` soft-delete where appropriate
3. Return errors in RFC7807 Problem+JSON.
4. Every endpoint must enforce tenant scoping and auth.
5. Provide OpenAPI (`/api/v1/openapi.json`) generated from route schemas.

## 5) Real-time requirements
Implement:
- Server publishes domain events to NATS (outbox pattern writes to DB then publishes).
- Realtime service subscribes to NATS, fans out to WS channels.
- Channels:
  - `course:{courseId}`
  - `forum:{forumId}:thread:{threadId}`
  - `dm:{conversationId}`
- Client uses WebSocket primarily; SSE fallback.

Real-time events must include:
- new/edited posts
- reactions added/removed
- assignment submission status changes
- grade updates
- typing indicators (ephemeral, redis TTL)

## 6) LTI 1.3 Advantage
Implement LTI 1.3 launch with OIDC, JWT validation, and the three Advantage services:
- Deep Linking
- Names and Role Provisioning Services (NRPS)
- Assignment and Grade Services (AGS)

Store registration + deployment + resource links in DB tables (`lti_*`). Provide admin UI to manage registrations.

## 7) SCIM 2.0
Expose SCIM endpoints at `/scim/v2`:
- `/ServiceProviderConfig`
- `/Schemas`
- `/ResourceTypes`
- `/Users` (GET/POST/PUT/PATCH/DELETE)
- `/Groups` (GET/POST/PUT/PATCH/DELETE)

Use RFC7643/7644 compliant payloads and ETags.
Map SCIM Users to `users` + `user_identities` (provider=scim).

## 8) Import/migration toolset
Create `tools/migrate-moodle`:
- Reads Moodle backup exports and/or DB extracts (Postgres/MySQL) + course archives.
- Imports:
  - courses, sections, modules
  - users (optional)
  - enrolments
  - forum posts
  - assignments + submissions
  - grades

Also create `tools/convert-plugins` framework:
- Takes a Moodle PHP plugin folder
- Extracts manifest metadata (version, capabilities, language strings)
- Produces an **Ako plugin skeleton** (TypeScript)
- Emits a report highlighting what can be auto-mapped vs manual work

Be honest: converting arbitrary PHP logic is not fully automatic; provide scaffolding and mapping stubs.

## 9) Testing, quality and CI
- Unit tests for domain logic
- Contract tests for API
- E2E smoke tests for key flows
- Linting + formatting
- GitHub Actions CI (build, test, docker build)

## 10) Deliverables checklist (do not skip)
- [ ] Working docker compose for local dev
- [ ] Database migrations/scripts (already scaffolded; add migrations tooling)
- [ ] API service with authentication + RBAC
- [ ] Frontend that can:
  - sign in via OIDC
  - list courses
  - view a course and modules
  - post in a forum thread with live updates
  - submit an assignment
  - view grades
- [ ] Realtime service working
- [ ] LTI 1.3 launch endpoints + stubs for NRPS/AGS/DL
- [ ] SCIM endpoints with CRUD
- [ ] Import tool skeleton
- [ ] Developer docs and ADRs

## 11) Build plan (execute in phases)
Phase 1: Foundation (DB, auth, tenants, RBAC, base UI, OpenAPI)
Phase 2: Courses + enrolments + cohorts/groups
Phase 3: Forums + messaging + reactions + realtime
Phase 4: Assignments + quiz engine + gradebook
Phase 5: LTI + SCIM + import/migration
Phase 6: Hardening (observability, rate limits, permissions audit)

### IMPORTANT
After each phase, run tests and ensure `docker compose up` works.
