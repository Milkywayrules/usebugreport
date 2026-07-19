# Epic E1: Capture SDK

**Goal:** Integrators embed `@usebugreport/browser` to capture Instant Replay, console, network, screenshot, and metadata on explicit submit (LG-1).

**FRs:** FR-1, FR-2, FR-3 | **ADs:** AD-4 (client-side path)

**Epic acceptance criteria:**
- SDK publishes as `@usebugreport/browser` from `packages/sdk`
- Buffer 30–120s (default 120s); privacy redaction per FR-2
- Submit calls ingest endpoints (implemented in E2)

---

## Story E1-S1: Monorepo scaffold and capture packages

As a platform engineer,
I want the turborepo monorepo with `packages/capture-core` and `packages/sdk` wired,
So that capture development has an isolated, publishable foundation.

**Acceptance Criteria:**

**Given** a fresh clone
**When** `bun install` and `turbo build` run
**Then** `apps/api`, `apps/web`, `apps/worker`, and packages per architecture §2 build without error
**And** dependency direction is `packages/sdk` → `packages/capture-core` → no `apps/` imports from packages (architecture §2)

**Given** CI runs `turbo test`
**When** no tests exist yet in new packages
**Then** placeholder `bun test` passes in `packages/capture-core` and `packages/sdk`

**Technical notes:** Root `turbo.json` tasks: `build`, `dev`, `test`, `test:parity`, `typecheck`, `db:migrate`. Dockerfiles stubbed under `docker/`. Stack: Bun 1.2.x, turborepo 2.x.

**Dependencies:** None (first story).

---

## Story E1-S2: Instant replay buffer and privacy plugins

As an integrator,
I want the SDK to record a circular rrweb buffer with console/network capture and privacy defaults,
So that bug reports include reproducible context without leaking credentials (FR-1, FR-2).

**Acceptance Criteria:**

**Given** SDK initialized with `projectKey`
**When** user interacts for up to 120 seconds without submitting
**Then** buffer retains only the last 120s of DOM events (configurable 30–120s per FR-1)
**And** `maskInputs` masks password and credit-card fields by default (FR-2)

**Given** fetch/XHR traffic during recording
**When** network plugin captures requests
**Then** `Authorization` headers and cookie values are redacted
**And** request/response bodies are capped at 32 KB each (FR-2)
**And** `ignoreRequestFn` excludes ingest endpoints to prevent feedback loops (FR-2)

**Given** console output at log/warn/error levels
**When** buffer is read at submit time
**Then** console events are included via rrweb official plugins (architecture stack: rrweb 2.x)

**Technical notes:** Implement in `packages/capture-core/src/record.ts`, `plugins/console.ts`, `plugins/network.ts`, `privacy/mask.ts`. Unit tests: `bun test packages/capture-core`.

**Dependencies:** E1-S1.

---

## Story E1-S3: Screenshot and environment metadata at submit

As an integrator,
I want full-page or viewport WebP screenshot plus environment metadata attached on submit,
So that reports include visual and context data agents can consume (FR-3).

**Acceptance Criteria:**

**Given** user triggers submit
**When** capture pipeline runs
**Then** screenshot is captured as WebP
**And** metadata JSON includes URL, viewport, DPR, user agent, timestamp
**And** optional `setMetadata()` hook values (e.g. `userId`, `releaseId`) merge into metadata (FR-3)

**Given** submit payload assembled
**When** gzip batching runs client-side
**Then** replay events, console, network, screenshot, and metadata are bundled for upload (FR-1 consequence)

**Technical notes:** `packages/capture-core/src/screenshot.ts`, `metadata.ts`. R2 key layout `{orgId}/{projectId}/{reportId}/` assigned server-side in E2; client sends logical blob parts.

**Dependencies:** E1-S2.

---

## Story E1-S4: Publishable `@usebugreport/browser` SDK package

As an integrator,
I want a documented npm package with init API and submit hook,
So that I can embed capture in my app with minimal bundle size (FR-1).

**Acceptance Criteria:**

**Given** `packages/sdk` build
**When** published as `@usebugreport/browser`
**Then** exports `init({ projectKey, bufferSeconds?, onSubmit? })` and `submit({ title, description })`
**And** package bundles only `capture-core` internals (no Mantine, no Radix)

**Given** invalid or missing `projectKey`
**When** `init()` is called
**Then** SDK throws a clear configuration error before recording starts

**Given** SDK unit tests
**When** `bun test packages/sdk`
**Then** buffer rotation, redaction, and gzip batching are covered (architecture §13 Testing: SDK layer)

**Technical notes:** Entry `packages/sdk/src/index.ts`. Tree-shakeable ESM. Peer dependency: none beyond browser APIs.

**Dependencies:** E1-S2, E1-S3.

---

## Story E1-S5: SDK submit widget (shadow DOM)

As an end user filing a bug,
I want a lightweight submit modal from the SDK widget or host hotkey,
So that I can title and submit a report without leaving the host app (FR-1, UX SDK widget spec).

**Acceptance Criteria:**

**Given** SDK `init()` with default widget enabled
**When** user opens submit UI (floating button or integrator hotkey)
**Then** shadow-root modal shows title input, description textarea, Submit/Cancel (EXPERIENCE.md SDK Widget)
**And** UI is Mantine-free and matches dark aesthetic loosely

**Given** successful ingest response from API (E2)
**When** submit completes
**Then** modal closes and host `onSubmit` callback receives `reportId`

**Given** ingest returns HTTP 401 or 429
**When** submit fails
**Then** modal shows tier/quota message with upgrade path copy for 429 (FR-4 UX; enforcement in E2)

**Technical notes:** `packages/sdk/src/widget/`. Calls `POST /api/v1/capture/presign` or inline path per payload size (E2). Sends `Idempotency-Key` header (AD-5).

**Dependencies:** E1-S4, E2-S2 (presign endpoint stub acceptable for widget integration test with mock API).
