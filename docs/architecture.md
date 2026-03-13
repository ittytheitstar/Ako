# Ako Architecture

## Overview

Ako is a modern, API-first Learning Management System built as a monorepo.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser/Client                        │
└────────────────────┬────────────────────┬───────────────────┘
                     │ HTTP/REST           │ WebSocket/SSE
                     ▼                    ▼
┌────────────────────────┐  ┌─────────────────────────────────┐
│   Next.js Web App      │  │     Realtime Gateway            │
│   apps/web (port 3000) │  │  services/realtime (port 8090)  │
└────────────────────────┘  └──────────────┬──────────────────┘
                                           │ Subscribe
┌──────────────────────────────────────────┼──────────────────┐
│          Fastify REST API                │                   │
│       services/api (port 8080)           │                   │
│  /api/v1/* + /scim/v2/*                 │                   │
└──────┬────────────┬──────────────────────┘                   │
       │ pg         │ Publish Events         NATS JetStream    │
       ▼            ▼                        ┌─────────────────┘
┌──────────┐  ┌──────────┐  ┌──────────┐   │
│PostgreSQL│  │  Redis   │  │   NATS   │◄──┘
│  (db)    │  │ (cache)  │  │(eventbus)│
└──────────┘  └──────────┘  └──────────┘
```

## Services

### `services/api` – REST API Gateway
- **Port**: 8080
- **Tech**: Fastify + TypeScript + PostgreSQL + Redis
- **Auth**: JWT (HS256) with Redis-backed refresh tokens
- **Endpoints**: `/api/v1/*` (REST), `/scim/v2/*` (SCIM 2.0)
- **Key responsibilities**: RBAC, tenant scoping, CRUD operations, outbox event publishing

### `services/realtime` – WebSocket/SSE Gateway
- **Port**: 8090
- **Tech**: Fastify + WebSocket + NATS
- **Protocol**: WS primary (`/ws?token=<jwt>`), SSE fallback (`/sse`)
- **Key responsibilities**: channel subscriptions, fan-out events to clients, typing indicators

### `apps/web` – Next.js Frontend
- **Port**: 3000
- **Tech**: Next.js 14 App Router + TanStack Query + Tailwind CSS
- **Key responsibilities**: User interface for all LMS workflows

## Packages

### `packages/shared`
Shared TypeScript types, domain event definitions, error classes. Used by all services.

### `packages/ui`
Reusable React component library: Button, Input, Card, Badge, Spinner, Alert, Modal, Avatar, Sidebar, DataTable.

### `packages/sdk`
Typed HTTP client SDK for the Ako API, wrapping all endpoints.

## Data Flow

1. Client makes REST request → `services/api`
2. API handles business logic, writes to PostgreSQL
3. API publishes domain event to `outbox_events` table
4. Outbox poller picks up event, publishes to NATS topic `ako.events.<type>`
5. `services/realtime` is subscribed to `ako.events.>` in NATS
6. Realtime service fans out event to all WS/SSE clients subscribed to the relevant channel

## Auth Flow

1. User POSTs credentials to `/api/v1/auth/token`
2. API validates, returns `{ accessToken, refreshToken }`
3. Client stores `accessToken` in memory, `refreshToken` in localStorage
4. Client includes `Authorization: Bearer <accessToken>` on requests
5. On 401, client uses `refreshToken` to get new `accessToken` via `/api/v1/auth/refresh`

## Multi-tenancy

- Every DB row has `tenant_id`
- JWT payload includes `tenantId` claim
- API middleware extracts `tenantId` from JWT, scopes all queries

## RBAC

- Permissions defined in `permissions` table (e.g., `course:view`, `grade:view`)
- Roles defined in `roles` table, linked to permissions via `role_permissions`
- Users assigned roles via `user_roles` with optional scope (tenant/course/group)
- Each API route can declare required permission(s) via `fastify.requirePermission(perm)`
