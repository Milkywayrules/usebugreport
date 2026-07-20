---
epic: infra
story_key: infra-2-shared-telemetry-package
status: backlog
depends_on:
  - infra-1-api-platform-hardening-and-billing-mocks
blocks: []
harness_mandates:
  - "HARNESS-ADDITIONAL-INSTRUCTIONS.md #5b–c — shared observability after API bootstrap"
right_hand_settlements:
  package_name: "packages/telemetry — NOT packages/logger, NOT @usebugreport/api-kit"
  worker_wiring: "Wire apps/worker when real jobs exist; API bootstrap stays in infra-1"
  non_goals: "No Grafana/Jaeger/Tempo on VPS in this story"
council_settlement:
  delegates:
    - id: 617e8a9b-d9d1-4502-a596-d2652f6a5e97
      name: Sol
    - id: fa6b989d-a76c-4c60-8ae1-3b9c2e02fefa
      name: Composer
    - id: 94aa6206-7877-4a63-92fa-d19005a0160a
      name: Fable
  verdict: unanimous
  split: "infra-2 observability completion after infra-1 foundation"
  rejects:
    - "@usebugreport/api-kit premature package"
    - "Monolithic api-kit bundling logger + otel + openapi"
    - "Grafana/Jaeger/Tempo VPS deployment in v1"
---

# Story infra-2: Shared telemetry package

Status: review

<!-- Observability completion — after infra-1, before production ingest; may parallel early E6. Council settlement ratified 2026-07-20 (Sol, Composer, Fable). -->

## Story

As a platform engineer,
I want a shared `@usebugreport/telemetry` package that centralizes redaction rules, evlog factory, OpenTelemetry init/shutdown, and traceId correlation into wide events,
so that the API and worker share one observability contract without duplicating logger or OTel bootstrap code, and production ingest can rely on consistent, safe structured logs.

## Acceptance Criteria

1. **Given** `packages/telemetry/` created, **when** inspected, **then** it exports: shared redaction helpers (secrets, `r2Key`, presigned URLs), an evlog factory (`createServiceLogger` or equivalent), OTel init/shutdown utilities, and traceId ↔ requestId correlation helpers for wide events. **And** the package is named `@usebugreport/telemetry` — **not** `packages/logger`, **not** `@usebugreport/api-kit`.

2. **Given** `apps/api` after infra-1, **when** refactored to consume `@usebugreport/telemetry`, **then** API behavior is unchanged: evlog wide events, redaction, OTel no-op when `OTEL_EXPORTER_OTLP_ENDPOINT` unset, no console span dumps by default. **And** inline duplicate bootstrap code in `apps/api/src/plugins/observability.ts` (or equivalent) is replaced by shared imports.

3. **Given** `apps/worker` with real background jobs (ingest finalize, outbox, etc.), **when** this story is implemented, **then** the worker imports `@usebugreport/telemetry` for logger + OTel bootstrap and emits wide events with `traceId` correlation on job handlers. **If** worker has no real jobs yet, **then** add a minimal bootstrap hook + unit test proving import/init only — defer full job instrumentation to the story that lands first real worker job.

4. **Given** redaction helpers in `@usebugreport/telemetry`, **when** unit tests pass a payload containing `Authorization`, ingest keys, `r2Key`, or presigned URL query params, **then** serialized log output redacts or omits those fields.

5. **Given** OTel init with `OTEL_EXPORTER_OTLP_ENDPOINT` **unset**, **when** `initTelemetry()` / `shutdownTelemetry()` run, **then** no exporter errors are thrown and no spans are exported. **And** graceful flush on shutdown completes without hanging tests.

6. **Given** OTel enabled via test env with a mock/no-op exporter, **when** a traced operation runs, **then** wide events include correlated `traceId` (or equivalent) alongside `requestId` where applicable.

7. **Given** `bun test packages/telemetry`, **when** run, **then** tests cover: redaction cases, disabled OTel (no exporter errors), graceful flush/shutdown.

8. **Out of scope:** Grafana, Jaeger, or Tempo deployment on VPS; `@usebugreport/api-kit`; OpenAPI/helmet wiring (infra-1); billing mocks (infra-1); changing success/error HTTP envelope shapes; landing on `main` without `feat/*` + PR.

## Tasks / Subtasks

- [ ] Task 1 — Create `packages/telemetry` (AC: 1, 4, 7)
  - [ ] `package.json`, `tsconfig.json`, turbo scripts
  - [ ] `src/redaction.ts` — shared secret / r2Key / presigned URL redaction
  - [ ] `src/evlog.ts` — service logger factory wrapping evlog `initLogger`
  - [ ] `src/otel.ts` — init/shutdown; guard on `OTEL_EXPORTER_OTLP_ENDPOINT`; no console dumps by default
  - [ ] `src/correlation.ts` — traceId ↔ requestId helpers for wide events
  - [ ] `src/index.ts` — public exports
  - [ ] `src/redaction.test.ts`, `src/otel.test.ts` — redaction, disabled OTel, graceful flush
- [ ] Task 2 — Refactor `apps/api` to use shared package (AC: 2)
  - [ ] Replace inline observability bootstrap with `@usebugreport/telemetry` imports
  - [ ] Verify existing platform tests still pass
- [ ] Task 3 — Worker bootstrap hook (AC: 3)
  - [ ] When `apps/worker` has real jobs: wire telemetry in worker entry + job handlers
  - [ ] Otherwise: minimal init import + smoke test only
- [ ] Task 4 — Verification gate (AC: 7)
  - [ ] `bun test packages/telemetry`
  - [ ] `bun test apps/api/src/__tests__/platform-*.test.ts` regression
  - [ ] `bunx turbo run lint typecheck test build`

## Dev Notes

### Goal

Extract observability shared by **api + worker** consumers into `@usebugreport/telemetry`. infra-1 lands API bootstrap inline first; this story hardens the shared package and worker hooks.

### Council settlement (binding — 2026-07-20)

Ratified by delegates **Sol** (`617e8a9b-d9d1-4502-a596-d2652f6a5e97`), **Composer** (`fa6b989d-a76c-4c60-8ae1-3b9c2e02fefa`), **Fable** (`94aa6206-7877-4a63-92fa-d19005a0160a`):

- Package name settled: **`packages/telemetry`** — not `packages/logger`, not monolithic `api-kit`
- Justified by api + worker consumers (shared redaction, evlog factory, otel init/shutdown, traceId correlation)
- Wire worker when `apps/worker` has real jobs; API full bootstrap remains infra-1
- Tests: redaction, disabled OTel no exporter errors, graceful flush
- Explicit non-goals: no Grafana/Jaeger/Tempo on VPS yet

### Dependency on infra-1

infra-1 wires evlog + `@elysiajs/opentelemetry` directly in `apps/api`. This story **extracts** that logic without behavior regression. Do not start infra-2 until infra-1 is merged.

### Package surface (suggested)

```typescript
// packages/telemetry/src/index.ts
export { redactWideEvent, redactSecrets } from "./redaction";
export { createServiceLogger } from "./evlog";
export { initTelemetry, shutdownTelemetry } from "./otel";
export { correlateTraceId } from "./correlation";
```

### Worker wiring

| Worker state | This story action |
| --- | --- |
| No real jobs yet | Bootstrap import + unit smoke only |
| Real jobs (E2 ingest finalize, E7 outbox, etc.) | Full logger + OTel on job handlers |

### Anti-patterns (do not do)

- Do not create `@usebugreport/api-kit` bundling openapi + helmet + telemetry
- Do not rename package to `packages/logger`
- Do not deploy Grafana/Jaeger/Tempo on VPS in this story
- Do not change HTTP envelope or success response shapes
- Do not add a second Pino logger

### Project structure (expected new/modified files)

```text
packages/telemetry/
  package.json
  tsconfig.json
  src/redaction.ts
  src/evlog.ts
  src/otel.ts
  src/correlation.ts
  src/index.ts
  src/redaction.test.ts
  src/otel.test.ts
apps/api/src/plugins/observability.ts   # REFACTOR — import telemetry
apps/worker/src/index.ts                # UPDATE when jobs exist
```

### References

- [Source: infra-1-api-platform-hardening-and-billing-mocks.md — API bootstrap predecessor]
- [Source: HARNESS-ADDITIONAL-INSTRUCTIONS.md#5b–c]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md — Logging conventions]

## Testing Requirements

```bash
bun test packages/telemetry/src/redaction.test.ts
bun test packages/telemetry/src/otel.test.ts
bun test apps/api/src/__tests__/platform-*.test.ts
bunx turbo run lint typecheck test build
```

| Area | Assertion |
| --- | --- |
| Redaction | Presigned URLs and r2Key never appear in serialized output |
| OTel disabled | Init/shutdown with unset endpoint — no errors |
| Graceful flush | Shutdown completes within test timeout |
| API regression | Platform tests unchanged after refactor |

## Definition of Done

- [ ] `@usebugreport/telemetry` exported with redaction, evlog factory, otel init/shutdown, correlation
- [ ] `apps/api` refactored to shared package; behavior unchanged
- [ ] Worker bootstrap wired or smoke-tested per worker job readiness
- [ ] Unit tests pass; turbo gate exit 0
- [ ] No VPS observability stack deployment

## Dev Agent Record

### Agent Model Used

_(unset)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-20: Story infra-2 created — council settlement split from infra-1; backlog pending infra-1 (Sol, Composer, Fable)
