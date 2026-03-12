# Ako (scaffold)

This folder contains **starter scaffolding** for an LMS project named **Ako**:

- `spec/` : product + API + DB definition JSON
- `db/` : PostgreSQL schema + seeds (auto-applied by docker compose)
- `docker-compose.yml` : local dev stack skeleton (db, redis, nats, api, realtime, web)

> This is **not** a complete implementation; it is a project starter kit and a set of machine-readable definitions you can feed into GitHub Copilot / agents to generate code consistently.

## Quick start

```bash
docker compose up -d
```

The API and web apps are placeholders: you still need to create `services/api`, `services/realtime`, and `apps/web`.

## Specs

- `spec/ako.product.json` – product scope
- `spec/ako.api.json` – API surface patterns
- `spec/ako.db.json` – DB table inventory

## Database

- `db/001_init.sql` – tables
- `db/002_seed.sql` – baseline permissions
