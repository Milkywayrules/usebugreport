# ADR: API platform logging and documentation (infra-1)

**Status:** accepted  
**Date:** 2026-07-20

## Context

Harness mandates #5 require structured logging, hybrid OpenAPI docs, and security headers on the Elysia API before E6 integrator REST work.

## Decisions

1. **Logging:** adopt **evlog** wide events (`initLogger` + `evlog/elysia`) as the single API logger. Do not run a parallel Pino logger.
2. **API docs:** replace architecture references to `@elysiajs/swagger` with **`@elysiajs/openapi`** + Scalar UI. Public integrator spec is **hybrid filtered** at `GET /openapi.json`; session BFF, onboarding, health, metrics, MCP, better-auth, `/api/web/*`, and dev probes stay excluded until E6 promotes routes via `integration-public` tags.
3. **OpenTelemetry:** bootstrap with `@elysiajs/opentelemetry` in `apps/api` only; default **no-op** when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset. Optional dev console span dumps require explicit `OTEL_CONSOLE_SPANS=1`.

## Consequences

- Shared `@usebugreport/telemetry` extraction deferred to infra-2.
- Error envelope types live in `@usebugreport/contracts`; success responses remain bare-data.
