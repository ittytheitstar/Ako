# Ako LMS

A modern, API-first, multi-tenant Learning Management System built with TypeScript, Fastify, Next.js, and PostgreSQL.

---

## Table of Contents

- [Feature Overview](#feature-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start (Docker)](#quick-start-docker)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Migration Tools](#migration-tools)
- [Kubernetes / Helm Deployment](#kubernetes--helm-deployment)
- [Architecture](#architecture)

---

## Feature Overview

Ako LMS is implemented across 12 phases. All phases are complete.

| Phase | Domain | Key Deliverables |
|-------|--------|-----------------|
| 1 | Foundation | OIDC SSO, Moodle migration CLI, plugin convert tool |
| 2 | Core LMS | Courses, sections, modules, enrolments, cohorts, gradebook, LTI |
| 3 | Communication | Forums, announcements, direct messaging, presence/heartbeat, notifications |
| 4 | Compliance & Reporting | Archive, retention policies, audit log, exports, reports |
| 5 | Extensibility | Plugins, webhooks, integrations, automation rules, feature flags, developer keys |
| 6 | Observability | Metrics, rate-limit management, permission audit, system alerts |
| 7 | Infrastructure | SCIM 2.0 provisioning, Helm/Kubernetes manifests |
| 8 | Completion | Module completion tracking, course progress, learner/admin views |
| 9 | Advanced Assessment | Question bank, quizzes, enhanced gradebook with grade scales |
| 10 | Calendar | Institutional calendar, external iCal sync, reminder preferences |
| 11 | Rich Activities | Lessons, choices, glossaries, workshops, wikis, attendance |
| 12 | Templates & Backup | Course copy wizard, template library, backup/restore, enhanced Moodle import |

### Phase 12 highlights

- **Course Copy** – Async copy of sections, modules, assessments, gradebook, calendar events, and completion criteria into a new draft course.
- **Template Library** – Mark any course as a reusable template; teachers browse and spin up new courses from the template gallery.
- **Backup & Restore** – Start a backup job per course (`POST /courses/:id/backup`), download the resulting package, and restore into a new or existing draft course.
- **Enhanced Moodle Import** – The `migrate-moodle` CLI now imports question bank categories/questions, gradebook structure (categories & items), and Phase 11 activity types (lessons, choices, glossaries, wikis).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Package manager | pnpm workspaces |
| API service | Fastify 4 + TypeScript |
| Frontend | Next.js 15 (App Router) + TanStack Query + Tailwind CSS |
| Database | PostgreSQL 16 |
| Cache / sessions | Redis 7 |
| Event bus | NATS 2 JetStream |
| Auth | JWT (HS256) + OIDC SSO |
| Container orchestration | Docker Compose (dev) / Kubernetes + Helm (prod) |

---

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 9 or later (`npm install -g pnpm`)
- **Docker** and **Docker Compose** (v2)
- **Git**

---

## Quick Start (Docker)

The fastest way to run the full stack locally:

```bash
# 1. Clone the repository
git clone <repo-url>
cd Ako

# 2. Install Node dependencies (needed to build images)
pnpm install --no-frozen-lockfile

# 3. Start the full stack
#    Builds and starts: PostgreSQL, Redis, NATS, API, Realtime gateway, Web app
docker compose up -d --build

# 4. Wait for all services to become healthy (~30 s on first run)
docker compose ps
```

### Access points

| Service | URL |
|---------|-----|
| Web UI | <http://localhost:3000> |
| REST API | <http://localhost:8080/api/v1> |
| Swagger UI | <http://localhost:8080/api/v1/docs> |
| NATS monitoring | <http://localhost:8222> |
| Realtime gateway | ws://localhost:8090 |

### Default credentials

A demo tenant and seed data are created by `db/002_seed.sql`. Check that file for the default tenant slug and any seeded user credentials. No admin user is created automatically — create one via the API:

```bash
curl -X POST http://localhost:8080/api/v1/users \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <admin-jwt>' \
  -d '{ "username": "admin", "email": "admin@demo.local", "display_name": "Admin" }'
```

---

## Local Development

Run services individually for faster iteration (infrastructure via Docker, code on the host):

```bash
# Start only the backing services
docker compose up -d db redis nats

# ── Terminal 1: API service ──────────────────────────────────────────────────
cd services/api
cp .env.example .env        # edit DATABASE_URL / REDIS_URL / JWT_SECRET as needed
pnpm dev                    # http://localhost:8080

# ── Terminal 2: Realtime gateway ─────────────────────────────────────────────
cd services/realtime
cp .env.example .env
pnpm dev                    # ws://localhost:8090

# ── Terminal 3: Web app ───────────────────────────────────────────────────────
cd apps/web
pnpm dev                    # http://localhost:3000
```

### Hot-reload

All three services watch source files and restart automatically. The shared `packages/shared` and `packages/sdk` packages must be built first if you change them:

```bash
pnpm --filter @ako/shared build
pnpm --filter @ako/sdk build
```

---

## Environment Variables

Each service has a `.env.example` file. Copy to `.env` before running locally.

### `services/api`

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://ako:ako@localhost:5432/ako` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `NATS_URL` | NATS connection string | `nats://localhost:4222` |
| `JWT_SECRET` | JWT signing secret (≥ 32 chars, **change in production**) | — |
| `PORT` | HTTP port | `8080` |
| `LOG_LEVEL` | Pino log level | `info` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `NODE_ENV` | `development` \| `production` | `development` |
| `OIDC_ISSUER` | OIDC provider URL (optional) | — |
| `OIDC_CLIENT_ID` | OIDC client ID (optional) | — |
| `OIDC_CLIENT_SECRET` | OIDC client secret (optional) | — |

### `services/realtime`

| Variable | Description | Default |
|----------|-------------|---------|
| `NATS_URL` | NATS connection string | `nats://localhost:4222` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Must match the API service secret | — |
| `PORT` | WebSocket port | `8090` |

### `apps/web`

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE` | Public-facing API base URL | `http://localhost:8080/api/v1` |
| `NEXT_PUBLIC_RT_BASE` | Public-facing realtime base URL | `ws://localhost:8090` |
| `API_BASE_INTERNAL` | Server-side API base URL (for SSR) | `http://api:8080/api/v1` |

---

## Database Migrations

All SQL migrations live in `db/` and are applied in filename order when the PostgreSQL container starts for the first time.

| File | Phase |
|------|-------|
| `001_init.sql` | Core schema (courses, users, roles, permissions, …) |
| `002_seed.sql` | Demo tenant and baseline permissions |
| `003_phase2.sql` | Terms, groups, cohorts, LTI, SCIM tables |
| `003_phase3.sql` | Announcements, presence, notifications |
| `004_phase4.sql` | Archive, retention, audit, exports, reports |
| `005_phase5.sql` | Plugins, webhooks, integrations, automation, feature flags |
| `006_phase6.sql` | Metrics, rate limits, permission audit, system alerts |
| `008_phase8.sql` | Completion tracking |
| `009_phase9.sql` | Question bank, quizzes, grade scales |
| `010_phase10.sql` | Calendar events, external sources, iCal tokens |
| `011_phase11.sql` | Lessons, choices, glossaries, workshops, wikis, attendance |
| `012_phase12.sql` | Copy jobs, backup jobs, restore jobs, course template columns |

### Reset the database

```bash
# Destroy all data and re-run migrations from scratch
docker compose down -v
docker compose up -d
```

### Apply migrations to an existing database manually

```bash
psql $DATABASE_URL -f db/012_phase12.sql
```

---

## Running Tests

```bash
# Run all package tests
pnpm test

# Run tests for a specific package
pnpm --filter @ako/api test
pnpm --filter @ako/migrate-moodle test

# Run with coverage
pnpm --filter @ako/api test -- --coverage
```

### Test summary

| Package | Tests |
|---------|-------|
| `packages/shared` | 12 (error types) |
| `services/api` | 24 (auth, RBAC, config) |
| `tools/migrate-moodle` | 15 (importer helpers, type mapping, Phase 9 & 11 additions) |
| `tools/convert-plugins` | 5 (plugin converter) |

---

## Project Structure

```
Ako/
├── apps/
│   └── web/                     # Next.js 15 frontend (App Router)
│       └── src/app/dashboard/
│           ├── courses/          # Course browser, builder, copy wizard
│           ├── templates/        # Learner template browser
│           ├── assignments/      # Assignment submission
│           ├── grades/           # Learner gradebook
│           ├── question-bank/    # Question bank browser
│           ├── calendar/         # Personal calendar + preferences
│           ├── lessons/          # Lesson player
│           ├── choices/          # Choice activity
│           ├── glossary/         # Glossary
│           ├── workshops/        # Workshop peer-review
│           ├── wikis/            # Wiki editor
│           ├── attendance/       # Attendance self-report
│           ├── forums/           # Discussion forums
│           ├── messages/         # Direct messaging
│           └── admin/            # Admin-only pages
│               ├── templates/    # Template library manager
│               ├── backup/       # Backup & restore management
│               ├── completion/   # Course completion management
│               ├── gradebook/    # Institution gradebook
│               ├── calendar/     # Institutional calendar
│               └── ...           # Observability, plugins, compliance, …
├── services/
│   ├── api/                     # Fastify REST API (port 8080)
│   │   └── src/routes/          # One file per domain
│   └── realtime/                # NATS→WebSocket gateway (port 8090)
├── packages/
│   ├── shared/                  # Shared TypeScript types & error classes
│   ├── sdk/                     # Typed HTTP client SDK (AkoClient)
│   └── ui/                      # Reusable React component library
├── tools/
│   ├── migrate-moodle/          # Moodle backup/DB import CLI
│   └── convert-plugins/         # Moodle plugin → Ako plugin converter
├── db/                          # SQL migration files (001–012)
├── infra/
│   ├── helm/                    # Helm chart for Kubernetes
│   └── k8s/                     # Raw Kubernetes manifests
└── docker-compose.yml           # Full-stack local dev environment
```

---

## API Reference

### Interactive docs

Swagger UI is available at **<http://localhost:8080/api/v1/docs>** once the API is running.

OpenAPI JSON: `GET http://localhost:8080/api/v1/openapi.json`

### Authentication

All `/api/v1/*` endpoints (except `/auth/*` and `/health`) require:

```
Authorization: Bearer <accessToken>
```

Obtain a token:

```bash
curl -X POST http://localhost:8080/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{ "username": "alice", "password": "secret" }'
# → { "accessToken": "...", "refreshToken": "..." }
```

Refresh a token:

```bash
curl -X POST http://localhost:8080/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{ "refreshToken": "..." }'
```

### Key API surface (Phase 12 additions)

```
POST   /api/v1/courses/:id/copy             Start an async course copy job
GET    /api/v1/copy-jobs                    List copy jobs (mine)
GET    /api/v1/copy-jobs/:jobId             Copy job status

GET    /api/v1/course-templates             List templates (filter: ?category=&tag=&q=)
POST   /api/v1/course-templates/:id/create-course  Create course from template
POST   /api/v1/courses/:id/promote-template Mark a course as a template
DELETE /api/v1/courses/:id/demote-template  Unmark a template

POST   /api/v1/courses/:id/backup           Start an async backup export
GET    /api/v1/backup-jobs                  List backup jobs
GET    /api/v1/backup-jobs/:jobId           Backup job status
GET    /api/v1/backup-jobs/:jobId/download  Download backup package

POST   /api/v1/courses/restore              Restore into a new course
POST   /api/v1/courses/:id/restore          Restore into an existing course
GET    /api/v1/restore-jobs                 List restore jobs
GET    /api/v1/restore-jobs/:jobId          Restore job status
```

### SCIM 2.0

User provisioning at `/scim/v2/`:

```
GET    /scim/v2/Users
POST   /scim/v2/Users
GET    /scim/v2/Users/:id
PUT    /scim/v2/Users/:id
PATCH  /scim/v2/Users/:id
DELETE /scim/v2/Users/:id
GET    /scim/v2/Groups
GET    /scim/v2/ServiceProviderConfig
```

### WebSocket Protocol

Connect: `ws://localhost:8090/ws?token=<accessToken>`

```json
// Subscribe to a channel
{ "type": "subscribe", "channel": "forum:abc:thread:xyz" }
// Unsubscribe
{ "type": "unsubscribe", "channel": "forum:abc:thread:xyz" }
// Typing indicator
{ "type": "typing", "channel": "forum:abc:thread:xyz" }
```

---

## Migration Tools

### migrate-moodle

Import a Moodle course into Ako from a `.mbz` backup archive or directly from the Moodle database.

```bash
cd tools/migrate-moodle
pnpm install && pnpm build

# Import from a Moodle .mbz backup archive
node dist/index.js backup \
  --file /path/to/backup.mbz \
  --db postgresql://ako:ako@localhost:5432/ako \
  [--tenant-id <uuid>] \
  [--import-users] \
  [--dry-run]

# Import from a Moodle PostgreSQL database
node dist/index.js database \
  --source-db postgresql://moodle:moodle@moodle-host:5432/moodle \
  --db postgresql://ako:ako@localhost:5432/ako \
  [--tenant-id <uuid>] \
  [--import-users] \
  [--dry-run]
```

**What gets imported:**

| Data | Status |
|------|--------|
| Courses, sections, modules | ✅ |
| Users & enrolments | ✅ (with `--import-users`) |
| Forum threads & posts (with thread metadata) | ✅ |
| Assignments & submissions | ✅ |
| Gradebook items & grades | ✅ |
| Gradebook categories & weights | ✅ Phase 9 |
| Question bank categories & questions | ✅ Phase 9 |
| Lessons (pages, questions) | ✅ Phase 11 |
| Choices (poll options) | ✅ Phase 11 |
| Glossaries & entries | ✅ Phase 11 |
| Wikis & pages | ✅ Phase 11 |
| File binary content / SCORM | ⚙️ Skeleton (path metadata stored) |

### convert-plugins

Convert Moodle plugin descriptors into the Ako plugin format.

```bash
cd tools/convert-plugins
pnpm install && pnpm build
node dist/index.js --input /path/to/moodle/plugin --output ./out
```

---

## Kubernetes / Helm Deployment

Raw Kubernetes manifests are in `infra/k8s/` and a Helm chart is in `infra/helm/`.

### Using Helm

```bash
# Add required secrets (edit infra/k8s/secrets.yaml first)
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/secrets.yaml

# Install via Helm
helm install ako ./infra/helm \
  --namespace ako \
  --set api.env.DATABASE_URL="postgresql://ako:PASS@db-host:5432/ako" \
  --set api.env.REDIS_URL="redis://redis-host:6379" \
  --set api.env.JWT_SECRET="<min-32-char-secret>" \
  --set api.env.NATS_URL="nats://nats-host:4222"

# Upgrade after changes
helm upgrade ako ./infra/helm --namespace ako
```

### Production checklist

- [ ] Set `JWT_SECRET` to a random secret of at least 32 characters
- [ ] Use a managed PostgreSQL instance (not the Docker image) in production
- [ ] Configure TLS on the Ingress (`infra/k8s/ingress.yaml`)
- [ ] Set `CORS_ORIGIN` to your actual frontend domain
- [ ] Configure OIDC variables (`OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`) for SSO
- [ ] Mount a persistent volume for backup file storage
- [ ] Set `NODE_ENV=production` on all services

---

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full system diagram.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser/Client                        │
└────────────────────┬────────────────────┬───────────────────┘
                     │ HTTP/REST           │ WebSocket
                     ▼                    ▼
┌────────────────────────┐  ┌─────────────────────────────────┐
│   Next.js Web App      │  │     Realtime Gateway            │
│   apps/web (port 3000) │  │  services/realtime (port 8090)  │
└────────────────────────┘  └──────────────┬──────────────────┘
                                           │ Subscribe
┌─────────────────────────────────────────┐│
│         Fastify REST API                ││
│      services/api (port 8080)           ││
│  /api/v1/* + /scim/v2/*                ││
└──────┬─────────────┬─────────────────────┘│
       │ SQL         │ Publish               │ NATS JetStream
       ▼             ▼                       │
┌──────────┐  ┌──────────┐  ┌──────────┐   │
│PostgreSQL│  │  Redis   │  │   NATS   │◄──┘
│  (db)    │  │ (cache)  │  │(eventbus)│
└──────────┘  └──────────┘  └──────────┘
```

### Key design decisions

- **Multi-tenant by default** — every row carries `tenant_id`; middleware enforces row-level isolation.
- **Async jobs** — long-running operations (course copy, backup, restore, exports) use job tables (`copy_jobs`, `backup_jobs`, `restore_jobs`, `export_jobs`) polled by the client.
- **Event-driven** — domain events are published to NATS and fanned out to WebSocket clients via the Realtime gateway.
- **TypeScript everywhere** — shared types in `packages/shared` ensure consistency across API, SDK, and frontend.

