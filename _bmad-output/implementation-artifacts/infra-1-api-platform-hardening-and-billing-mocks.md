---
epic: infra
story_key: infra-1-api-platform-hardening-and-billing-mocks
depends_on:
  - 4-1-better-auth-github-oauth-and-session
  - 4-6-usageservice-tier-limits-at-service-boundary-ad-11
blocks:
  - 6-2-surface-registry-and-route-validation
  - 7-1-linear-oauth-and-integrationservice-config
harness_mandates:
  - "HARNESS-ADDITIONAL-INSTRUCTIONS.md #2 — billing mock package"
  - "HARNESS-ADDITIONAL-INSTRUCTIONS.md #5a–e — Elysia platform plugins"
right_hand_settlements:
  openapi_scalar: "HYBRID — public filtered OpenAPI + Scalar UI for same filtered surface; full/internal/admin omitted from public artifact"
  wiring_location: "apps/api only — no @usebugreport/api-kit"
  envelope_types: "may live in @usebugreport/contracts for shared shape"
  billing_package: "@usebugreport/billing — BillingProvider + MockBillingProvider; TIER_LIMITS from @usebugreport/config; Free+Pro sellable; Studio/Agency throw not-purchasable"
---

# Story infra-1: API platform hardening and billing mocks

Status: drafted

<!-- Harness infrastructure story — implements unmet HARNESS #5 (a–e) + HARNESS #2. Right-hand settlements ratified; do not relitigate. -->

## Story

As a platform engineer,
I want the API server wired with hybrid OpenAPI docs, observability, structured logging, security headers, a global error envelope, and a mock billing provider,
so that integrators see only intentional public surfaces, operators get traces and wide events, and tier purchase flows can be exercised without a payment gateway (HARNESS #2, HARNESS #5).

## Acceptance Criteria

1. **Given** `@usebugreport/billing` added under `packages/billing/`, **when** inspected, **then** it exports a `BillingProvider` interface and `MockBillingProvider` class, **and** tier limit lookups import `TIER_LIMITS`, `BillingTier`, `isSellableTier`, and `getTierLimits` from `@usebugreport/config` (never duplicate numeric limits locally).

2. **Given** `MockBillingProvider.purchaseTier({ organizationId, targetTier, userId })`, **when** `targetTier` is `free` or `pro`, **then** the mock updates `organization.billing_tier` in Postgres and returns `{ ok: true, tier, organizationId }`. **When** `targetTier` is `studio` or `agency`, **then** it throws `NotPurchasableTierError` (or equivalent typed error) with code `NOT_PURCHASABLE` — no silent downgrade.

3. **Given** `MockBillingProvider.getSellableTiers()`, **when** called, **then** it returns exactly `["free", "pro"]` derived from `isSellableTier()` over `@usebugreport/config` tiers — not hardcoded strings duplicated from config.

4. **Given** `@elysiajs/openapi` wired in `apps/api/src/index.ts` (or `apps/api/src/plugins/openapi.ts`), **when** a route is registered, **then** it carries an OpenAPI tag of exactly one of: `public`, `authenticated`, `internal` (right-hand settlement A). **And** dev probes (`/api/v1/protected-probe`, `/api/v1/auth/context-probe`, `/api/v1/auth/scope-probe`) are tagged `internal`.

5. **Given** hybrid public documentation (settlement A), **when** `GET /openapi/json` (or configured `specPath`) is requested, **then** the JSON spec includes **only** routes tagged `public` (today: at minimum `/health` and `/` — document tagging convention for future E2/E6 integrator routes). **And** `GET /openapi` serves Scalar UI for that **same filtered** spec — no session-only or internal routes in the public artifact.

6. **Given** session-authenticated REST routes under `/api/v1/*` (workspaces, projects, members, api-keys, user-preferences, session, onboarding), **when** listed in server route metadata, **then** they are tagged `authenticated` and **omitted** from the public OpenAPI JSON until explicitly promoted to `public` by a future integrator story.

7. **Given** `@elysiajs/opentelemetry` applied in `apps/api`, **when** a request hits any route, **then** an HTTP span is created with method, route template, and status. **And** when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset, the app still starts (no-op / console exporter acceptable in dev).

8. **Given** `evlog` initialized via `initLogger({ env: { service: "usebugreport-api", environment: process.env.NODE_ENV } })` and `.use(evlog())` from `evlog/elysia`, **when** a request completes, **then** one wide event is emitted with at least `{ method, path, status, durationMs, requestId }`. **And** logs never include secrets (`Authorization`, ingest keys, presigned URLs) — redact or omit per architecture § Consistency Conventions logging rule.

9. **Given** helmet middleware applied in `apps/api` (prefer `elysia-helmet` — official helmet port for Elysia; document choice in Dev Notes), **when** any response is sent, **then** security headers include `X-Content-Type-Options: nosniff` and `X-Frame-Options` (or CSP `frame-ancestors` equivalent). **And** Scalar/OpenAPI UI routes use relaxed CSP only on `/openapi` paths if required for Scalar CDN.

10. **Given** architecture §12 error envelope `{ error: { code, message, details?, requestId } }`, **when** any unhandled exception or `ServiceError` reaches the global handler, **then** the response body matches the envelope shape with a valid `requestId` matching the request context. **And** `ApiErrorCode` includes at minimum: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `VALIDATION_ERROR`, `INTERNAL` (extend `apps/api/src/lib/errors.ts` and shared types in `@usebugreport/contracts`).

11. **Given** existing integration tests (`apps/api/src/__tests__/auth.integration.test.ts`, etc.), **when** run after this story, **then** they still pass without regressions — unauthorized responses remain `{ error: { code: "UNAUTHORIZED", message, requestId } }` with HTTP 401.

12. **Given** `bun test packages/billing` and `bun test apps/api`, **when** run, **then** new tests pass:
    - billing: sellable purchase updates tier; studio/agency throw `NOT_PURCHASABLE`; config import smoke (no duplicated limits)
    - api: public OpenAPI JSON excludes an `internal`-tagged probe route; helmet header assertion on `/health`; envelope shape on forced 500 path (test-only route or mocked throw)

13. **Out of scope:** Stripe/payment gateway, billing checkout UI, `@usebugreport/api-kit` package, populating `packages/contracts/src/surface-registry.ts` (E6-S2), ingest/MCP route documentation beyond tagging convention, worker OpenTelemetry (defer to E2-S8), updating `sprint-status.yaml`, real billing webhooks.

## Tasks / Subtasks

- [ ] Task 1 — `@usebugreport/billing` package (AC: 1–3, 12)
  - [ ] Create `packages/billing/package.json`, `tsconfig.json`, turbo scripts (`build`, `test`, `typecheck`, `lint`)
  - [ ] Define `BillingProvider` in `packages/billing/src/provider.ts`
  - [ ] Implement `MockBillingProvider` in `packages/billing/src/mock.ts` using Drizzle update on `organization.billing_tier`
  - [ ] Export `NotPurchasableTierError` from `packages/billing/src/errors.ts`
  - [ ] Add `packages/billing/src/mock.test.ts` — sellable tiers, stub rejection, config re-export guard (grep test or snapshot that `TIER_LIMITS.free.maxReportsPerMonth === 30` comes from config import)
  - [ ] Wire workspace dependency in root `package.json` workspaces (already `packages/*`)
- [ ] Task 2 — Shared envelope types in contracts (AC: 10)
  - [ ] Add `packages/contracts/src/api-envelope.ts` — `ApiErrorCode`, `ApiErrorEnvelope`, success pagination helpers if needed
  - [ ] Re-export from `packages/contracts/src/index.ts`
  - [ ] Refactor `apps/api/src/lib/errors.ts` to import types from `@usebugreport/contracts`; add `internalError()`, `rateLimitedError()` helpers; map unknown throws to `INTERNAL` in global handler
- [ ] Task 3 — Elysia platform plugins in `apps/api` (AC: 4–9, 10–11)
  - [ ] Create `apps/api/src/plugins/platform.ts` (or split: `openapi.ts`, `observability.ts`, `security.ts`) — **all wiring stays under `apps/api/src/`**
  - [ ] Install and configure `@elysiajs/openapi` with `provider: 'scalar'`, public spec filter by tag `public`, route tag registry module `apps/api/src/lib/route-tags.ts`
  - [ ] Tag all existing routes in `apps/api/src/index.ts` and `apps/api/src/routes/*.ts`
  - [ ] Install `@elysiajs/opentelemetry` + minimal OTLP config; guard on env
  - [ ] Install `evlog`, call `initLogger` in `apps/api/src/index.ts` before app listen; `.use(evlog({ exclude: ['/health'] }))` or equivalent
  - [ ] Install `elysia-helmet`; apply globally with Scalar-friendly CSP override on `/openapi*`
  - [ ] Add global `onError` hook producing architecture envelope; preserve existing `serviceErrorToHttp` mapping
- [ ] Task 4 — API integration tests (AC: 5, 9, 10–12)
  - [ ] `apps/api/src/__tests__/platform-openapi.test.ts` — public spec excludes internal routes
  - [ ] `apps/api/src/__tests__/platform-security.test.ts` — helmet headers on `/health`
  - [ ] `apps/api/src/__tests__/platform-envelope.test.ts` — INTERNAL envelope on test error route (non-production only)
  - [ ] Verify existing auth/onboarding/RBAC integration suites still green
- [ ] Task 5 — Verification gate (AC: 12)
  - [ ] Run repo verification commands in Testing Requirements

## Dev Notes

### Goal

Close harness gaps **#2** (billing mock package) and **#5 a–e** (OpenAPI+Scalar hybrid, OpenTelemetry, evlog, standardized envelope, helmet) in one vertical slice. Right-hand settlements are binding — do not introduce `@usebugreport/api-kit` or duplicate tier constants.

### Harness mandate traceability

| Harness # | Requirement | This story |
| --- | --- | --- |
| #2 | Pricing tiers + mock billing interfaces | `packages/billing` — `BillingProvider`, `MockBillingProvider` |
| #5a | OpenAPI + Scalar | `@elysiajs/openapi`, hybrid public filter, Scalar at `/openapi` |
| #5b | OpenTelemetry | `@elysiajs/opentelemetry` on Elysia app |
| #5c | evlog | `evlog` + `evlog/elysia` wide events |
| #5d | Standardized envelope | Global handler + `@usebugreport/contracts` types; extend existing `errors.ts` |
| #5e | helmet | `elysia-helmet` on Elysia app |

**Already implemented elsewhere (do not redo):** multi-tenant better-auth (#3), tier limits in `UsageService` (#2 limits authority via `packages/config/src/tiers.ts`), branch/PR workflow (#4).

### Current repo state (READ BEFORE EDIT)

| Path | Current state | This story changes |
| --- | --- | --- |
| `apps/api/src/index.ts` | Elysia app: cors, session, api-key, onboarding middleware; no openapi/otel/evlog/helmet; manual `jsonResponse` | Add platform plugins chain; global envelope handler |
| `apps/api/src/lib/errors.ts` | Partial envelope — missing `INTERNAL`, `RATE_LIMITED`; local types | Import shared types from contracts; extend helpers |
| `packages/contracts/src/index.ts` | Placeholder stub only | Add `api-envelope.ts` exports |
| `packages/config/src/tiers.ts` | **Single source of truth** for `TIER_LIMITS`, `isSellableTier` | Consumed by billing — never copied |
| `packages/db/src/schema/billing.ts` | `billingTierEnum` only | Mock provider updates `organization.billing_tier` column (added in migration `0002_tiny_stardust.sql`) |
| `packages/services/src/usage.ts` | Reads tier from org row via `resolveOrgBilling` | Unchanged; mock billing writes same column |
| `packages/contracts/src/surface-registry.ts` | Empty `[]` — E6-S2 | Do not populate here; OpenAPI tags are separate until registry lands |

### Existing API routes (tagging reference)

Tag in route registration metadata (exact paths today):

| Tag | Routes |
| --- | --- |
| `public` | `GET /`, `GET /health` (future: ingest integrator paths from E2 — leave hook in `route-tags.ts`) |
| `authenticated` | `GET /api/v1/session`, `POST /api/v1/onboarding/workspace`, all `/api/v1/workspaces*`, `/api/v1/projects*`, `/api/v1/user/preferences`, workspace api-keys |
| `internal` | `GET /api/v1/protected-probe`, `GET /api/v1/auth/context-probe`, `GET /api/v1/auth/scope-probe` |
| *(omit from public spec)* | better-auth mount `/api/auth/*` — not in public OpenAPI artifact |

Session middleware already assigns `requestId` via `createRequestId()` in `apps/api/src/middleware/session.ts` — reuse same id in envelope + evlog wide events.

### Hybrid OpenAPI + Scalar (settlement A)

Architecture originally references `@elysiajs/swagger` at `GET /openapi.json`. **Use `@elysiajs/openapi` instead** (Elysia 1.x official plugin; Scalar default UI at `/openapi`, spec at `/openapi/json`). Implement filter:

```typescript
// apps/api/src/lib/openapi-public-filter.ts (conceptual)
const PUBLIC_TAGS = new Set(["public"]);

export function filterPublicOpenApiSpec(spec: OpenAPIObject): OpenAPIObject {
  // Keep paths where every operation tag intersects PUBLIC_TAGS
  // Drop paths tagged only authenticated | internal
}
```

Register filtered spec endpoint for public consumers; Scalar `provider: 'scalar'` reads same filtered document. **Do not** expose authenticated session routes or internal probes in public JSON.

Route tagging convention for future stories: E6 REST integrator routes promote to `public` explicitly; until then stay `authenticated`.

### Platform plugin stack (settlement B — inside `apps/api` only)

Recommended packages (document in PR / Dev Agent Record; ask King before exotic alternatives):

| Concern | Package | Notes |
| --- | --- | --- |
| OpenAPI + Scalar | `@elysiajs/openapi` | `provider: 'scalar'`; align with Elysia `^1.2.0` — verify peer `>=1.4.0`; bump `elysia` in `apps/api/package.json` if required |
| OpenTelemetry | `@elysiajs/opentelemetry` | Optional OTLP via `OTEL_EXPORTER_OTLP_ENDPOINT`; no-op when unset |
| Structured logging | `evlog`, `evlog/elysia` | `initLogger` at startup; wide events per request |
| Security headers | `elysia-helmet` | Port of official helmet; CSP exception for Scalar CDN on `/openapi*` |

**Do not create** `@usebugreport/api-kit`. If plugin setup exceeds ~200 lines, split under `apps/api/src/plugins/` only.

Suggested middleware order in `index.ts`:

```text
opentelemetry → helmet → evlog → cors → openapi → session → api-key → onboarding → routes → onError
```

### Standardized envelope (settlement B + architecture §12)

Current partial implementation:

```1:16:apps/api/src/lib/errors.ts
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "VALIDATION_ERROR";

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}
```

**Gaps to close:** add `INTERNAL` to union; global `onError` for uncaught exceptions; ensure success responses that today return raw objects optionally gain `{ data, requestId }` only where existing routes already include `requestId` — **do not mass-refactor success shapes** in this story (scope: errors + shared types).

Move types to `packages/contracts/src/api-envelope.ts` so future MCP/REST parity tests (E6-S4) share one shape.

### `@usebugreport/billing` design (settlement C)

```typescript
// packages/billing/src/provider.ts — suggested surface
import type { BillingTier } from "@usebugreport/config";

export interface PurchaseTierInput {
  organizationId: string;
  targetTier: BillingTier;
  userId: string;
}

export interface PurchaseTierResult {
  ok: true;
  organizationId: string;
  tier: BillingTier;
}

export interface BillingProvider {
  getWorkspaceTier(organizationId: string): Promise<BillingTier>;
  getSellableTiers(): BillingTier[];
  purchaseTier(input: PurchaseTierInput): Promise<PurchaseTierResult>;
}
```

`MockBillingProvider` constructor accepts `{ db: DbClient }` from `@usebugreport/db`. On sellable purchase: `UPDATE organization SET billing_tier = $tier WHERE id = $organizationId`. On studio/agency: throw `NotPurchasableTierError` before DB write.

**Anti-pattern:** duplicating `TIER_LIMITS` numbers in billing package — import from `@usebugreport/config` only.

**Out of scope:** wiring billing routes/UI; E7/E8 will consume provider later.

### OpenTelemetry env (optional v1)

Add to `packages/config/src/env.ts` only if needed (optional fields):

- `OTEL_EXPORTER_OTLP_ENDPOINT` — optional URL
- `OTEL_SERVICE_NAME` — default `usebugreport-api`

Do not block local dev when unset.

### evlog + architecture logging convention

Architecture requires JSON structured logs with `{ level, msg, traceId, organizationId, reportId, userId }`. evlog wide events satisfy this — map `requestId` ↔ trace correlation; set `organizationId` in authenticated handlers via `log.set({ organizationId })` where route context already resolves org (optional enhancement in route helpers, not mandatory on every route this story).

Exclude high-cardinality noise: `/health` checks, better-auth static assets if any.

### Helmet vs Scalar CSP

Scalar loads JS from CDN by default. Options:

1. Relax CSP `script-src` only for `/openapi` and `/openapi/json`
2. Or self-host Scalar bundle via `@elysiajs/openapi` `scalar.cdn` config

Pick one; document in Dev Agent Record. Do not weaken CSP on authenticated API JSON routes.

### Dependency on completed stories

- **4-6:** `billing_tier` on `organization`, `TIER_LIMITS`, `UsageService` — mock billing must update same column UsageService reads
- **4-1..4-5:** Existing routes and auth middleware — platform plugins wrap, do not replace

### Anti-patterns (do not do)

- Do not create `@usebugreport/api-kit` or move plugin wiring out of `apps/api`
- Do not duplicate `TIER_LIMITS` in billing or OpenAPI descriptions
- Do not expose internal/dev probe routes in public OpenAPI JSON
- Do not implement Stripe, Lemon Squeezy, or checkout sessions
- Do not change success response shapes repo-wide (only error envelope standardization)
- Do not set story status to `ready-for-dev` or edit `sprint-status.yaml` in this drafting pass
- Do not log `Authorization`, ingest keys, or presigned URLs

### Project structure (expected new/modified files)

```text
packages/billing/
  package.json
  tsconfig.json
  src/provider.ts
  src/mock.ts
  src/errors.ts
  src/index.ts
  src/mock.test.ts
packages/contracts/src/api-envelope.ts
apps/api/src/plugins/platform.ts          # or split files
apps/api/src/lib/openapi-public-filter.ts
apps/api/src/lib/route-tags.ts
apps/api/src/lib/errors.ts                # UPDATE — import contracts types
apps/api/src/index.ts                     # UPDATE — plugin chain
apps/api/package.json                     # UPDATE — new deps
apps/api/src/__tests__/platform-*.test.ts
packages/config/src/env.ts                # optional OTEL vars
```

### References

- [Source: HARNESS-ADDITIONAL-INSTRUCTIONS.md#2, #5]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#Consistency Conventions — Error envelope, Logging]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#12. API Conventions — OpenAPI, error envelope]
- [Source: packages/config/src/tiers.ts — TIER_LIMITS, isSellableTier]
- [Source: apps/api/src/lib/errors.ts — current envelope]
- [Source: apps/api/src/index.ts — current Elysia bootstrap]
- [Source: _bmad-output/implementation-artifacts/4-6-usageservice-tier-limits-at-service-boundary-ad-11.md — billing_tier column]
- [Source: https://elysiajs.com/plugins/openapi — @elysiajs/openapi + Scalar]
- [Source: https://elysiajs.com/plugins/opentelemetry — @elysiajs/opentelemetry]
- [Source: https://www.evlog.dev/integrate/frameworks/elysia — evlog/elysia]
- [Source: https://github.com/tobias-kaerst-software/elysia-helmet — elysia-helmet]

## Testing Requirements

Run from repo root after implementation; all must exit 0:

```bash
bun install
bunx biome check .
bunx turbo run lint typecheck test build

# Billing mock (primary gate)
bun test packages/billing/src/mock.test.ts

# API platform tests
bun test apps/api/src/__tests__/platform-openapi.test.ts
bun test apps/api/src/__tests__/platform-security.test.ts
bun test apps/api/src/__tests__/platform-envelope.test.ts

# Regression — existing API suites
bun test apps/api/src/__tests__/auth.integration.test.ts
bun test apps/api/src/__tests__/onboarding-gate.test.ts
```

**Required test cases:**

| Area | Assertion |
| --- | --- |
| Mock billing — Pro purchase | Org row `billing_tier` becomes `pro` |
| Mock billing — Studio purchase | Throws `NOT_PURCHASABLE`; tier unchanged |
| Mock billing — config import | Sellable list matches `isSellableTier` over config tiers |
| Public OpenAPI | `/openapi/json` paths exclude `/api/v1/auth/context-probe` |
| Public OpenAPI | `/openapi/json` includes `/health` |
| Helmet | Response includes `x-content-type-options: nosniff` |
| Envelope | Uncaught error returns `{ error: { code: "INTERNAL", requestId } }` |
| Regression | Auth 401 still `{ error: { code: "UNAUTHORIZED", ... } }` |

**Not required:** Playwright, MCP parity, OTLP exporter integration test (manual/smoke OK), billing HTTP routes.

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `@usebugreport/billing` exports provider + mock; no duplicated tier limits
- [ ] Hybrid public OpenAPI + Scalar live; internal/authenticated routes excluded from public spec
- [ ] OpenTelemetry, evlog, helmet wired in `apps/api` only
- [ ] Error envelope types in `@usebugreport/contracts`; global handler covers `INTERNAL`
- [ ] New + existing API tests pass; `turbo lint typecheck test build` exit 0
- [ ] Story status remains `drafted` until King promotes to `ready-for-dev`

## Dev Agent Record

### Agent Model Used

_(unset — story drafted only)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-20: Story infra-1 drafted — harness #2 billing mocks + harness #5 API platform hardening (OpenAPI/Scalar hybrid, OTel, evlog, envelope, helmet)
