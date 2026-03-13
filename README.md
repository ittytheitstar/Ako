# Ako LMS

A modern, API-first Learning Management System.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the full stack (PostgreSQL, Redis, NATS, API, Realtime, Web)
docker compose up -d

# Access
# Web UI:   http://localhost:3000
# API:      http://localhost:8080/api/v1
# Swagger:  http://localhost:8080/api/v1/docs
# NATS:     http://localhost:8222
```

## Development (without Docker)

```bash
# Start infrastructure
docker compose up -d db redis nats

# API service
cd services/api && cp .env.example .env && pnpm dev

# Realtime service
cd services/realtime && cp .env.example .env && pnpm dev

# Web app
cd apps/web && pnpm dev
```

## Running Tests

```bash
pnpm test
pnpm test --filter @ako/api
```

## Architecture

See [docs/architecture.md](docs/architecture.md).
