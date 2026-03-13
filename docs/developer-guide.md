# Developer Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- Git

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd Ako
pnpm install
```

### 2. Start the full stack

```bash
docker compose up -d
```

This starts: PostgreSQL, Redis, NATS, API service, Realtime service, and Web app.

### 3. Access the apps

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3000 |
| API | http://localhost:8080/api/v1 |
| API Docs (Swagger) | http://localhost:8080/api/v1/docs |
| NATS monitoring | http://localhost:8222 |

### 4. Default credentials

A default tenant and admin user are created by `db/002_seed.sql`. Check that file for credentials.

## Development

### Run services locally (without Docker)

```bash
# Start infrastructure only
docker compose up -d db redis nats

# Run API in dev mode
cd services/api
cp .env.example .env
pnpm dev

# Run Realtime in dev mode
cd services/realtime
cp .env.example .env
pnpm dev

# Run Web in dev mode
cd apps/web
pnpm dev
```

### Environment Variables

Each service has a `.env.example` file. Copy to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://ako:ako@localhost:5432/ako` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `NATS_URL` | NATS connection string | `nats://localhost:4222` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | — |
| `PORT` | Service port | 8080 |

### Database Migrations

SQL migrations are in `db/`. Applied automatically by Docker on first start.
To reset: `docker compose down -v && docker compose up -d`

### Running Tests

```bash
pnpm test                         # all packages
pnpm --filter @ako/api test       # just API
```

## Architecture

See [architecture.md](./architecture.md) for the full architecture diagram.

## API Reference

Swagger UI is available at `http://localhost:8080/api/v1/docs`.

OpenAPI JSON: `http://localhost:8080/api/v1/openapi.json`

## SCIM 2.0

SCIM provisioning endpoints are at `/scim/v2/` on the API service:
- `GET /scim/v2/Users`
- `POST /scim/v2/Users`
- `GET /scim/v2/Users/:id`
- `PUT /scim/v2/Users/:id`
- `PATCH /scim/v2/Users/:id`
- `DELETE /scim/v2/Users/:id`
- `GET /scim/v2/Groups`
- `GET /scim/v2/ServiceProviderConfig`

## WebSocket Protocol

Connect to `ws://localhost:8090/ws?token=<jwt>`

Send messages:
```json
{ "type": "subscribe", "channel": "forum:abc:thread:xyz" }
{ "type": "unsubscribe", "channel": "forum:abc:thread:xyz" }
{ "type": "typing", "channel": "forum:abc:thread:xyz" }
```

Receive messages:
```json
{ "type": "event", "event": "post.created", "channel": "...", "data": {...} }
{ "type": "typing", "channel": "...", "userId": "..." }
{ "type": "subscribed", "channel": "..." }
```
