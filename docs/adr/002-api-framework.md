# ADR 002: Fastify as API Framework

## Status: Accepted

## Context
We need a Node.js HTTP framework for the REST API.

## Decision
Use Fastify (v4) with TypeScript.

## Rationale
- Fastest Node.js HTTP framework by benchmark
- First-class TypeScript support with typed routes
- Plugin ecosystem: jwt, cors, multipart, swagger, rate-limit, websocket
- JSON Schema / Zod validation integration
- Built-in request/response serialization

## Consequences
- Team needs familiarity with Fastify plugin architecture
- Swagger generation requires route schema definitions
