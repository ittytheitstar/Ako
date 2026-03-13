# ADR 001: Monorepo with pnpm Workspaces

## Status: Accepted

## Context
Ako has multiple services (API, realtime, web) and shared packages. We need a strategy for managing them.

## Decision
Use a pnpm workspace monorepo. All services and packages live in the same repository.

## Rationale
- Shared code (types, schemas) can be referenced directly without publishing to npm
- Atomic commits across services
- Single CI pipeline
- Easy local development with workspace: protocol

## Consequences
- All developers need pnpm installed
- Build tooling must understand workspace dependencies
- CI must build packages in dependency order
