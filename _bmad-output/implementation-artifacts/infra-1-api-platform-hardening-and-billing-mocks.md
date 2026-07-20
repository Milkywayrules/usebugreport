---
epic: infra
story_key: infra-1-api-platform-hardening-and-billing-mocks
status: ready-for-dev
depends_on:
  - 4-1-better-auth-github-oauth-and-session
  - 4-6-usageservice-tier-limits-at-service-boundary-ad-11
blocks:
  - infra-2-shared-telemetry-package
  - 6-2-surface-registry-and-route-validation
  - 7-1-linear-oauth-and-integrationservice-config
harness_mandates:
  - "HARNESS-ADDITIONAL-INSTRUCTIONS.md #2 — billing mock package"
  - "HARNESS-ADDITIONAL-INSTRUCTIONS.md #5a–e — Elysia platform plugins"
right_hand_settlements:
  openapi_scalar: "HYBRID — public filtered OpenAPI + Scalar UI for same filtered integration surface only; session BFF, onboarding, health, metrics, MCP, better-auth, /api/web/*, dev probes excluded"
  wiring_location: "apps/api only — no @usebugreport/api-kit; Next.js security headers out of scope"
  envelope_types: "shared error envelope in @usebugreport/contracts; bare-data success responses unchanged; pagination stays { data, page }"
  billing_package: "@usebugreport/billing — BillingProvider + MockBillingProvider; TIER_LIMITS from @usebugreport/config; Free+Pro sellable; Studio/Agency throw NOT_PURCHASABLE"
  otel_default: "default OFF / no-op in prod; OTLP only when OTEL_EXPORTER_OTLP_ENDPOINT configured; no console span dumps by default"
  branch_policy: "feat/* branch + PR only — do not land on main directly"
council_settlement:
  delegates:
    - id: 617e8a9b-d9d1-4502-a596-d2652f6a5e97
      name: Sol
    - id: fa6b989d-a76c-4c60-8ae1-3b9c2e02fefa
      name: Composer
    - id: 94aa6206-7877-4a63-92fa-d19005a0160a
      name: Fable
  verdict: unanimous
  split: "infra-1 foundation (this story) + infra-2 shared telemetry package (follow-on)"
  rejects:
    - "Universal success wrapper { data, meta }"
    - "Fully public or fully private OpenAPI docs"
    - "@usebugreport/api-kit premature package"
    - "Landing on main without feat/* + PR"
---

# Story infra-1: API platform hardening and billing mocks

Status: ready-for-dev

<!-- Foundation slice — land ASAP on feat/* before E6 meaningful REST. Council settlement ratified 2026-07-20 (Sol, Composer, Fable). -->

## Story

As a platform engineer,
I want the API server wired with hybrid OpenAPI docs skeleton, observability bootstrap, structured logging, security headers, a global error envelope, request-id propagation, and a mock billing provider,
so that integrators see only intentional public integration surfaces, operators get optional traces and wide events, and tier purchase flows can be exercised without a payment gateway (HARNESS #2, HARNESS #5).

## Acceptance Criteria

1. **Given** `@usebugreport/billing` added under `packages/billing/`, **when** inspected, **then** it exports a `BillingProvider` interface and `MockBillingProvider` class, **and** tier limit lookups import `TIER_LIMITS`, `BillingTier`, `isSellableTier`, and `getTierLimits` from `@usebugreport/config` (never duplicate numeric limits locally).

2. **Given** `MockBillingProvider.purchaseTier({ organizationId, targetTier, userId })`, **when** `targetTier` is `free` or `pro`, **then** the mock updates `organization.billing_tier` in Postgres and returns `{ ok: true, tier, organizationId }`. **When** `targetTier` is `studio` or `agency`, **then** it throws `NotPurchasableTierError` (or equivalent typed error) with code `NOT_PURCHASABLE` — no silent downgrade.

3. **Given** `MockBillingProvider.getSellableTiers()`, **when** called, **then** it returns exactly `["free", "pro"]` derived from `isSellableTier()` over `@usebugreport/config` tiers — not hardcoded strings duplicated from config.

4. **Given** `@elysiajs/openapi` wired in `apps/api` (prefer `apps/api/src/plugins/openapi.ts` composed via `.use()`), **when** the plugin is registered, **then** it exposes a **hybrid filtered** public spec at `GET /openapi.json` (alias `/openapi/json` if the plugin default differs) and Scalar UI at `/docs` or `/openapi` reading the **same filtered document**. **And** the public artifact excludes: session BFF routes, onboarding, `/health`, `/metrics`, `/mcp`, better-auth handler (`/api/auth/*`), `/api/web/*`, and dev probes (`/api/v1/protected-probe`, `/api/v1/auth/context-probe`, `/api/v1/auth/scope-probe`). **And** per-route Zod/Elysia schemas for meaningful REST integrator endpoints are **out of scope** (E6) — skeleton may be sparse until E6 promotes routes.

5. **Given** route composition in `apps/api`, **when** platform plugins are added, **then** they are composed with typed `.use()` plugin modules (not casts that break the OpenAPI type chain). Fix existing casts only if cheap.

6. **Given** `@elysiajs/opentelemetry` applied in `apps/api`, **when** `OTEL_EXPORTER_OTLP_ENDPOINT` (or equivalent) is **unset**, **then** the app starts with OTel **disabled / no-op** — no OTLP exporter errors, **no console span dumps by default** (dev may opt in via explicit env flag documented in Dev Notes). **When** `OTEL_EXPORTER_OTLP_ENDPOINT` **is** set, **then** HTTP spans are created with method, route template, and status.

7. **Given** `evlog` initialized via `initLogger({ env: { service: "usebugreport-api", environment: process.env.NODE_ENV } })` and `.use(evlog())` from `evlog/elysia`, **when** a request completes, **then** one wide event is emitted with at least `{ method, path, status, durationMs, requestId }`. **And** logs never include secrets or sensitive paths — redact or omit `Authorization`, ingest keys, `r2Key`, and presigned URLs. **And** there is **no second Pino logger** alongside evlog.

8. **Given** `elysia-helmet` applied in `apps/api` only, **when** any API response is sent, **then** security headers include `X-Content-Type-Options: nosniff` and `X-Frame-Options` (or CSP `frame-ancestors` equivalent). **And** Scalar/OpenAPI UI routes use relaxed CSP only on `/docs` or `/openapi*` paths if required for Scalar CDN. **And** Next.js app security headers remain **out of scope**.

9. **Given** architecture §12 error envelope `{ error: { code, message, details?, requestId } }`, **when** any unhandled exception or `ServiceError` reaches the global handler, **then** the response body matches the envelope shape with a valid `requestId` matching the request context. **And** shared types live in `@usebugreport/contracts` (or equivalent shared module re-exported from contracts). **And** `ApiErrorCode` includes only supported codes: at minimum `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `VALIDATION_ERROR`, `INTERNAL` — do not invent unsupported codes. **And** `QUOTA_EXCEEDED` maps to HTTP **429**, not 403.

10. **Given** any API request, **when** a response is returned, **then** the response includes a global `X-Request-Id` header whose value matches the `requestId` in error envelopes and evlog wide events. Reuse existing `createRequestId()` from session middleware where present; propagate consistently through error handler and logging.

11. **Given** existing integration tests (`apps/api/src/__tests__/auth.integration.test.ts`, etc.), **when** run after this story, **then** they still pass without regressions — unauthorized responses remain `{ error: { code: "UNAUTHORIZED", message, requestId } }` with HTTP 401. **And** success responses remain **bare-data** (no universal `{ data, meta }` wrapper); pagination continues `{ data, page }` where already used.

12. **Given** `bun test packages/billing` and `bun test apps/api`, **when** run, **then** new tests pass:
    - billing: sellable purchase updates tier; studio/agency throw `NOT_PURCHASABLE`; config import smoke (no duplicated limits)
    - api: public OpenAPI JSON excludes `/health`, internal probes, and session/onboarding routes; helmet header assertion on a representative API route; envelope shape on forced 500 path (test-only route or mocked throw); `QUOTA_EXCEEDED` returns 429; `X-Request-Id` present on responses

13. **Out of scope:** Stripe/payment gateway, billing checkout UI, `@usebugreport/api-kit` package, `@usebugreport/telemetry` shared package (infra-2), populating `packages/contracts/src/surface-registry.ts` (E6-S2), per-route OpenAPI schema completeness (E6), worker OpenTelemetry wiring beyond API bootstrap (infra-2), Next.js security headers, Grafana/Jaeger/Tempo on VPS, universal success wrapper `{ data, meta }`, real billing webhooks, landing directly on `main`.

## Tasks / Subtasks

- [ ] Task 0 — Branch / PR gate
  - [ ] Implement on `feat/*` branch; open PR — do not push to `main` directly
- [ ] Task 1 — `@usebugreport/billing` package (AC: 1–3, 12)
  - [ ] Create `packages/billing/package.json`, `tsconfig.json`, turbo scripts (`build`, `test`, `typecheck`, `lint`)
  - [ ] Define `BillingProvider` in `packages/billing/src/provider.ts`
  - [ ] Implement `MockBillingProvider` in `packages/billing/src/mock.ts` using Drizzle update on `organization.billing_tier`
  - [ ] Export `NotPurchasableTierError` from `packages/billing/src/errors.ts`
  - [ ] Add `packages/billing/src/mock.test.ts` — sellable tiers, stub rejection, config re-export guard
  - [ ] Wire workspace dependency in root `package.json` workspaces (already `packages/*`)
- [ ] Task 2 — Shared error envelope in contracts (AC: 9–11)
  - [ ] Add `packages/contracts/src/api-envelope.ts` — `ApiErrorCode`, `ApiErrorEnvelope`
  - [ ] Re-export from `packages/contracts/src/index.ts`
  - [ ] Refactor `apps/api/src/lib/errors.ts` to import types from `@usebugreport/contracts`; add `internalError()`, `rateLimitedError()` helpers; map unknown throws to `INTERNAL` in global handler
  - [ ] Fix `QUOTA_EXCEEDED` → HTTP 429 in `serviceErrorToHttp` (or equivalent mapper)
  - [ ] Do **not** wrap success responses in `{ data, meta }`
- [ ] Task 3 — Elysia platform plugins in `apps/api` (AC: 4–10)
  - [ ] Create typed plugin modules under `apps/api/src/plugins/` — compose via `.use()` in `index.ts`
  - [ ] Install and configure `@elysiajs/openapi` with `provider: 'scalar'`, hybrid public spec filter, route tag registry `apps/api/src/lib/route-tags.ts`
  - [ ] Tag existing routes; exclude non-integration surfaces from public spec per AC 4
  - [ ] Install `@elysiajs/opentelemetry`; guard on `OTEL_EXPORTER_OTLP_ENDPOINT`; default no-op; no console span dumps unless dev opt-in env set
  - [ ] Install `evlog`, call `initLogger` before listen; `.use(evlog())` with redaction for `r2Key`, presigned URLs, secrets
  - [ ] Install `elysia-helmet`; apply globally with Scalar-friendly CSP override on docs paths only
  - [ ] Add global `onError` hook producing architecture envelope; add `X-Request-Id` response header middleware
- [ ] Task 4 — Architecture ADR note (AC: implicit)
  - [ ] Amend architecture `.memlog` or add short ADR under architecture folder: Pino → evlog; `@elysiajs/swagger` → `@elysiajs/openapi`
- [ ] Task 5 — API integration tests (AC: 4, 8–12)
  - [ ] `apps/api/src/__tests__/platform-openapi.test.ts` — public spec excludes health, probes, session/onboarding
  - [ ] `apps/api/src/__tests__/platform-security.test.ts` — helmet headers on representative route
  - [ ] `apps/api/src/__tests__/platform-envelope.test.ts` — INTERNAL envelope; QUOTA_EXCEEDED 429; X-Request-Id header
  - [ ] Verify existing auth/onboarding/RBAC integration suites still green
- [ ] Task 6 — Verification gate (AC: 12)
  - [ ] Run repo verification commands in Testing Requirements

## Dev Notes

### Goal

Close harness gaps **#2** (billing mock package) and **#5 a–e** (OpenAPI+Scalar hybrid skeleton, OpenTelemetry bootstrap, evlog, standardized error envelope, helmet) in one foundation vertical slice on `feat/*`. Land before E6 meaningful REST. Shared `packages/telemetry` extraction is **infra-2**, not this story.

### Council settlement (binding — 2026-07-20)

Ratified by delegates **Sol** (`617e8a9b-d9d1-4502-a596-d2652f6a5e97`), **Composer** (`fa6b989d-a76c-4c60-8ae1-3b9c2e02fefa`), **Fable** (`94aa6206-7877-4a63-92fa-d19005a0160a`):

- Split infra into **infra-1 foundation** (this story) + **infra-2 shared telemetry** (follow-on)
- HYBRID OpenAPI only — filtered integration surface; exclude health, session BFF, onboarding, metrics, MCP, better-auth, `/api/web/*`, dev probes
- Keep bare-data success + existing error envelope + `{ data, page }` pagination — **reject** `{ data, meta }` universal wrapper
- Reject `@usebugreport/api-kit`; all wiring stays in `apps/api`
- OTel default OFF; no console span dumps unless dev opt-in
- evlog only — no parallel Pino logger
- `QUOTA_EXCEEDED` → 429
- Implementer must note Pino→evlog and swagger→`@elysiajs/openapi` in architecture ADR/memlog

### Harness mandate traceability

| Harness # | Requirement | This story |
| --- | --- | --- |
| #2 | Pricing tiers + mock billing interfaces | `packages/billing` — `BillingProvider`, `MockBillingProvider` |
| #5a | OpenAPI + Scalar | `@elysiajs/openapi`, hybrid filtered spec, Scalar at `/docs` or `/openapi` |
| #5b | OpenTelemetry | `@elysiajs/opentelemetry` on Elysia app — bootstrap only; shared package deferred to infra-2 |
| #5c | evlog | `evlog` + `evlog/elysia` wide events; redact r2Key / presigned URLs |
| #5d | Standardized envelope | Global handler + `@usebugreport/contracts` error types; extend existing `errors.ts` |
| #5e | helmet | `elysia-helmet` on `apps/api` only |

**Already implemented elsewhere (do not redo):** multi-tenant better-auth (#3), tier limits in `UsageService` (#2 limits authority via `packages/config/src/tiers.ts`), branch/PR workflow (#4).

### Current repo state (READ BEFORE EDIT)

| Path | Current state | This story changes |
| --- | --- | --- |
| `apps/api/src/index.ts` | Elysia app: cors, session, api-key, onboarding middleware; no openapi/otel/evlog/helmet; manual `jsonResponse` | Add platform plugins chain via `.use()`; global envelope handler; X-Request-Id |
| `apps/api/src/lib/errors.ts` | Partial envelope — missing `INTERNAL`; `QUOTA_EXCEEDED` may map to wrong status | Import shared types from contracts; fix 429 mapping |
| `packages/contracts/src/index.ts` | Placeholder stub only | Add `api-envelope.ts` exports |
| `packages/config/src/tiers.ts` | **Single source of truth** for `TIER_LIMITS`, `isSellableTier` | Consumed by billing — never copied |
| `packages/db/src/schema/billing.ts` | `billingTierEnum` only | Mock provider updates `organization.billing_tier` column |
| `packages/contracts/src/surface-registry.ts` | Empty `[]` — E6-S2 | Do not populate here |

### Hybrid OpenAPI + Scalar (filtered integration surface)

Architecture originally references `@elysiajs/swagger` at `GET /openapi.json`. **Use `@elysiajs/openapi` instead** (Elysia 1.x official plugin; Scalar default UI). Public spec is intentionally **sparse** until E6 promotes integrator routes.

**Excluded from public artifact** (never appear in filtered JSON or Scalar):

| Category | Examples |
| --- | --- |
| Ops / health | `/health`, `/metrics` |
| Session BFF | `/api/v1/session`, authenticated workspace/project CRUD |
| Onboarding | `/api/v1/onboarding/*` |
| Auth handler | `/api/auth/*` (better-auth) |
| Web BFF | `/api/web/*` |
| MCP | `/mcp` |
| Dev probes | `/api/v1/protected-probe`, `/api/v1/auth/context-probe`, `/api/v1/auth/scope-probe` |

Future E6 integrator REST routes promote into the filtered spec explicitly via route tags / surface registry.

```typescript
// apps/api/src/lib/openapi-public-filter.ts (conceptual)
const INTEGRATION_TAGS = new Set(["integration-public"]); // sparse until E6

export function filterPublicOpenApiSpec(spec: OpenAPIObject): OpenAPIObject {
  // Keep only paths tagged for public integration surface
}
```

### Platform plugin stack (inside `apps/api` only)

| Concern | Package | Notes |
| --- | --- | --- |
| OpenAPI + Scalar | `@elysiajs/openapi` | `provider: 'scalar'`; public spec at `/openapi.json`; skeleton OK |
| OpenTelemetry | `@elysiajs/opentelemetry` | OFF when `OTEL_EXPORTER_OTLP_ENDPOINT` unset; no console dumps by default |
| Structured logging | `evlog`, `evlog/elysia` | Single logger; redact secrets + r2Key + presigned URLs |
| Security headers | `elysia-helmet` | `apps/api` only; CSP exception for Scalar CDN on docs paths |

**Do not create** `@usebugreport/api-kit` or `@usebugreport/telemetry` (infra-2).

Suggested middleware order in `index.ts`:

```text
opentelemetry → helmet → evlog → cors → openapi → session → api-key → onboarding → routes → onError
```

Compose each concern as a typed Elysia plugin via `.use()`.

### Standardized error envelope (architecture §12)

Move error types to `packages/contracts/src/api-envelope.ts`. Success responses stay as-is (bare objects or `{ data, page }` for pagination). **Do not** introduce `{ data, meta }`.

Known fix: `QUOTA_EXCEEDED` must return HTTP **429**, not 403.

Global `X-Request-Id` on all responses; same value as envelope `requestId` and evlog wide events.

### `@usebugreport/billing` design

```typescript
// packages/billing/src/provider.ts — suggested surface
import type { BillingTier } from "@usebugreport/config";

export interface BillingProvider {
  getWorkspaceTier(organizationId: string): Promise<BillingTier>;
  getSellableTiers(): BillingTier[];
  purchaseTier(input: PurchaseTierInput): Promise<PurchaseTierResult>;
}
```

`MockBillingProvider` updates `organization.billing_tier` for sellable tiers; throws `NotPurchasableTierError` for studio/agency.

### OpenTelemetry env

- `OTEL_EXPORTER_OTLP_ENDPOINT` — optional; when unset, OTel is no-op
- `OTEL_SERVICE_NAME` — default `usebugreport-api`
- Dev-only opt-in env for console span export — document in PR; **not enabled by default**

### evlog redaction

Redact or omit: `Authorization`, ingest keys, `r2Key`, presigned URLs (query strings with signature params). Exclude high-cardinality noise: `/health`, better-auth static assets.

### Architecture ADR (implementer action)

Add memlog entry or short ADR file under `_bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/` (or equivalent architecture folder):

- Logging: Pino → **evlog** (wide events, single logger)
- API docs: `@elysiajs/swagger` → **`@elysiajs/openapi`** + Scalar hybrid filter

### Anti-patterns (do not do)

- Do not create `@usebugreport/api-kit` or `@usebugreport/telemetry` in this story
- Do not duplicate `TIER_LIMITS` in billing or OpenAPI descriptions
- Do not expose health, session BFF, onboarding, or dev probes in public OpenAPI JSON
- Do not implement Stripe or checkout sessions
- Do not wrap all success responses in `{ data, meta }`
- Do not add a second Pino logger alongside evlog
- Do not enable console OTel span dumps by default
- Do not land on `main` without PR from `feat/*`

### Project structure (expected new/modified files)

```text
packages/billing/
  src/provider.ts, mock.ts, errors.ts, index.ts, mock.test.ts
packages/contracts/src/api-envelope.ts
apps/api/src/plugins/openapi.ts          # typed .use() plugins
apps/api/src/plugins/observability.ts
apps/api/src/plugins/security.ts
apps/api/src/lib/openapi-public-filter.ts
apps/api/src/lib/route-tags.ts
apps/api/src/lib/errors.ts               # UPDATE
apps/api/src/index.ts                    # UPDATE
apps/api/src/__tests__/platform-*.test.ts
_bmad-output/planning-artifacts/.../adr-*.md  # Pino→evlog, swagger→openapi note
```

### References

- [Source: HARNESS-ADDITIONAL-INSTRUCTIONS.md#2, #5]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md]
- [Source: packages/config/src/tiers.ts]
- [Source: apps/api/src/lib/errors.ts]
- [Source: infra-2-shared-telemetry-package.md — follow-on shared package]

## Testing Requirements

Run from repo root after implementation; all must exit 0:

```bash
bun install
bunx biome check .
bunx turbo run lint typecheck test build

bun test packages/billing/src/mock.test.ts
bun test apps/api/src/__tests__/platform-openapi.test.ts
bun test apps/api/src/__tests__/platform-security.test.ts
bun test apps/api/src/__tests__/platform-envelope.test.ts
bun test apps/api/src/__tests__/auth.integration.test.ts
bun test apps/api/src/__tests__/onboarding-gate.test.ts
```

| Area | Assertion |
| --- | --- |
| Mock billing — Pro purchase | Org row `billing_tier` becomes `pro` |
| Mock billing — Studio purchase | Throws `NOT_PURCHASABLE`; tier unchanged |
| Public OpenAPI | Spec excludes `/health`, probes, session/onboarding routes |
| Helmet | API response includes `x-content-type-options: nosniff` |
| Envelope | Uncaught error returns `{ error: { code: "INTERNAL", requestId } }` |
| Quota | `QUOTA_EXCEEDED` returns HTTP 429 |
| Request ID | Response includes `X-Request-Id` matching envelope `requestId` |
| OTel disabled | App starts cleanly with `OTEL_EXPORTER_OTLP_ENDPOINT` unset |
| Regression | Auth 401 still `{ error: { code: "UNAUTHORIZED", ... } }` |

**Not required:** Playwright, MCP parity, OTLP exporter integration test, billing HTTP routes, worker telemetry (infra-2).

## Definition of Done

- [ ] All acceptance criteria met on `feat/*` via PR
- [ ] `@usebugreport/billing` exports provider + mock; no duplicated tier limits
- [ ] Hybrid filtered OpenAPI skeleton + Scalar live; non-integration routes excluded
- [ ] OTel bootstrap no-op by default; evlog + helmet wired in `apps/api` only
- [ ] Error envelope types in `@usebugreport/contracts`; `QUOTA_EXCEEDED` → 429; `X-Request-Id` global
- [ ] Architecture ADR/memlog notes Pino→evlog and swagger→openapi
- [ ] New + existing API tests pass; `turbo lint typecheck test build` exit 0

## Dev Agent Record

### Agent Model Used

_(unset)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-20: Story infra-1 drafted — harness #2 billing mocks + harness #5 API platform hardening
- 2026-07-20: Council settlement applied — split infra-2; HYBRID OpenAPI skeleton; OTel default OFF; QUOTA_EXCEEDED→429; reject { data, meta }; ready-for-dev (Sol, Composer, Fable)
