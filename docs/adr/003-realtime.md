# ADR 003: WebSocket + NATS for Real-time

## Status: Accepted

## Context
Ako requires real-time updates for forums, messaging, grades, and assignments.

## Decision
Use WebSocket (primary) with SSE fallback, backed by NATS JetStream as the event bus.

## Rationale
- NATS provides durable message delivery and fan-out across multiple realtime instances
- WebSocket is the most efficient bidirectional transport
- SSE is a simple fallback for environments that block WS
- Outbox pattern (DB → NATS) ensures events are not lost even if realtime is down

## Consequences
- Requires NATS running as infrastructure
- Clients need WebSocket support (available in all modern browsers)
- SSE is unidirectional; typing indicators use WS only
- Multiple realtime instances share subscriptions via NATS
