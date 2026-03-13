# Phase 6 – Platform Hardening, Observability & Security

## Goal

Harden the platform for **production-grade institutional operation** by delivering:
- Deep observability (metrics, traces, structured logging)
- Configurable rate limiting and quota management
- Permissions and security auditing
- System health monitoring and alerting
- Performance safeguards and operational controls

Phase 6 turns Ako from a feature-rich platform into an **enterprise-ready, resilient system** that
can be operated safely at scale. It builds on all prior phases and introduces no new learning
features — its value is operational confidence and security assurance.

---

## Scope & Deliverables

### 1. Observability

#### Metrics
- Prometheus-compatible `/metrics` endpoint
- Per-tenant request counters and latency histograms
- Database pool utilisation metrics
- Cache hit/miss ratios (Redis)
- Background job success/failure counts

#### Distributed Tracing (stubs)
- OpenTelemetry SDK integration points
- Trace context propagation headers (`traceparent`)
- Sampling configuration

#### Structured Logging
- Consistent JSON log format across all services
- Correlation IDs tied to requests and background jobs
- Log level overrides per tenant (debug-assist mode)

**Done when** an operator can answer "what is the p99 latency for course-list requests?" using
the metrics endpoint.

---

### 2. Rate Limiting & Quotas

#### Tenant-level Rate Limits
- Configurable per-tenant request-per-minute limits
- Separate limits for read vs. write operations
- API key-specific limits (stricter defaults)

#### Route-level Overrides
- Fine-grained limits per endpoint pattern
- Burst allowances
- Graceful degradation (429 with `Retry-After` header)

#### Quota Management
- Storage quotas (files, exports)
- Enrolment count limits per tenant
- Plugin count caps

**Done when** a tenant exceeding their quota receives a meaningful 429 and the event is
observable in the admin dashboard.

---

### 3. Permissions Audit & Security

#### Permission Matrix
- Query which permissions each role holds
- Identify unused permissions (not exercised in last N days)
- Detect overly-broad assignments

#### Security Events
- Failed authentication attempts
- Privilege-escalation attempts
- Unusual access patterns (after-hours, bulk exports)

#### Hardening Controls
- Security headers (CSP, HSTS, X-Frame-Options via middleware)
- API key rotation policy enforcement
- Inactive session cleanup schedule

**Done when** an admin can view a permission matrix and receive alerts on anomalous activity.

---

### 4. Enhanced Health Checks

#### Check Types
- **Liveness** (`/health/live`) — process is running, not deadlocked
- **Readiness** (`/health/ready`) — all dependencies (DB, Redis, NATS) are available
- **Startup** (`/health/startup`) — migrations complete, seed data present

#### Dependency Detail
- Database connection pool utilisation
- Redis latency (ping round-trip)
- NATS connectivity and subscriber counts
- Background job queue depth

**Done when** Kubernetes liveness and readiness probes can be pointed at distinct endpoints
with meaningful failure detail.

---

### 5. System Alerts

#### Alert Configuration
- Admin-configurable thresholds (e.g. error rate > 5 %, queue depth > 1000)
- Alert channels: in-platform notification + webhook delivery

#### Built-in Alert Rules
- High error rate
- DB connection pool saturation
- Long-running export jobs (> 10 min)
- Expired API keys (7-day warning)

**Done when** admins receive an in-platform alert when error rate breaches a configured
threshold.

---

## Domain Model Additions

### New Entities
- `rate_limit_configs` — per-tenant / per-route limit settings
- `permission_audit_logs` — permission check outcomes for analysis
- `metric_snapshots` — periodic platform metric summaries
- `system_alerts` — alert rule definitions and trigger history

### Key Fields
- `window_seconds`, `max_requests` (rate limit config)
- `permission_name`, `granted`, `checked_at` (audit log)
- `metric_name`, `value`, `labels` (snapshot)
- `threshold_value`, `comparison`, `last_triggered_at` (alerts)

---

## API Surface (v1)

### Metrics
- `GET /metrics` — Prometheus text format (secured, admin only)
- `GET /metrics/summary` — JSON summary for dashboard consumption

### Rate Limits
- `GET /rate-limits` — list all tenant rate limit configs
- `POST /rate-limits` — create / override a rate limit rule
- `PATCH /rate-limits/{id}` — update a rule
- `DELETE /rate-limits/{id}` — remove override (revert to default)

### Permission Audit
- `GET /permission-audit/matrix` — role × permission matrix for tenant
- `GET /permission-audit/events` — filtered log of permission checks / denials
- `GET /permission-audit/anomalies` — detected anomalies

### Health
- `GET /health/live` — liveness probe
- `GET /health/ready` — readiness probe (existing `/health` renamed + extended)
- `GET /health/startup` — startup probe

### System Alerts
- `GET /system-alerts` — list alert rules
- `POST /system-alerts` — create alert rule
- `PATCH /system-alerts/{id}` — update
- `DELETE /system-alerts/{id}` — delete
- `GET /system-alerts/triggered` — recent triggered alerts

---

## Service Logic

### Metrics Collection
1. Fastify hooks increment counters and record histograms per request lifecycle
2. Background worker scrapes DB/Redis stats on a 15-second interval
3. Periodic worker writes `metric_snapshots` rows for trend storage
4. `/metrics` endpoint serialises current in-memory counters to Prometheus text

### Permission Audit Pipeline
1. RBAC plugin emits a `permission.checked` event on every authorisation decision
2. Audit worker writes to `permission_audit_logs` (async, non-blocking)
3. Anomaly detector runs every hour; flags unusual patterns

### Alert Engine
1. Alert evaluator reads `system_alerts` rules on a configurable interval
2. When a rule fires: creates an `audit_events` row + sends platform notification
3. Webhook fan-out if the tenant has active webhook subscriptions for `alert.triggered`

---

## UI Expectations

### Admins
- **Observability dashboard** — live metrics summary, error rate graph, latency percentiles
- **Rate limits manager** — view and edit per-tenant and per-route limits
- **Permission audit** — role matrix viewer, denial log, anomaly list
- **System alerts** — rule list with create/edit/delete, triggered alert history

---

## Permissions (Minimum)
- `metrics:view`
- `ratelimit:manage`
- `permission:audit`
- `alert:manage`

---

## Events Emitted
- `metrics.snapshot.created`
- `ratelimit.exceeded`
- `permission.denied`
- `alert.triggered | resolved`

---

## Acceptance Criteria

1. Prometheus scrape of `/metrics` returns request counters and latency histograms
2. A tenant exceeding their rate limit receives a 429 with `Retry-After`
3. An admin can view which roles hold which permissions across the tenant
4. Liveness and readiness probes return distinct, meaningful status responses
5. An alert rule can be created and fires a platform notification when breached

---

## Phase 6 Backlog (Order)
1. Enhanced health probes (liveness / readiness / startup)
2. In-process Prometheus metrics collection
3. Tenant-level rate limit configuration
4. Permission audit log pipeline
5. Metric snapshots worker
6. Observability admin dashboard
7. Rate limits admin UI
8. Permission audit admin UI
9. System alert engine
10. System alerts admin UI
11. Security headers middleware
12. OpenTelemetry integration stubs
13. Runbooks and operational documentation
