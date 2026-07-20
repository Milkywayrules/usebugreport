---
baseline_commit: 0a72b63
depends_on:
  - 1-1-monorepo-scaffold-and-capture-packages
blocks:
  - 1-3-screenshot-and-environment-metadata-at-submit
  - 1-4-publishable-usebugreport-browser-sdk-package
---

# Story 1.2: instant replay buffer and privacy plugins

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an integrator,
I want the SDK to record a circular rrweb buffer with console/network capture and privacy defaults,
so that bug reports include reproducible context without leaking credentials (FR-1, FR-2).

## Acceptance Criteria

1. **Given** capture initialized with default options, **when** the user interacts for up to 120 seconds without submitting, **then** the circular buffer retains only the last **120 seconds** of DOM replay events (FR-1 default); **and** `bufferSeconds` is configurable in the range **30–120** inclusive with validation that clamps or throws on out-of-range values.

2. **Given** `bufferSeconds` is set to 60, **when** recording runs for 90 seconds of simulated wall time (test-controlled clocks), **then** a snapshot export contains replay events whose timestamps span at most ~60 seconds (plus one checkout boundary tolerance); **and** older checkout segments are evicted (memory-bounded circular buffer).

3. **Given** rrweb recording is active, **when** DOM mutations, input, scroll, and navigation occur, **then** events are captured via `rrweb` `record()` with checkout-based segmentation (`checkoutEveryNms` aligned to buffer window); **and** the buffer stores enough checkout segments to replay the retained window without requiring full-session history.

4. **Given** default privacy configuration, **when** password or credit-card inputs exist in the DOM, **then** values are masked (`maskAllInputs: true` with type-based overrides for `password` and credit-card field patterns per FR-2 / PRD `maskInputs: ['password', 'credit-card']`); **and** integrator-supplied `maskSelectors` (CSS selectors) additionally mask matching elements.

5. **Given** elements marked with block-class convention `ubr-block` (configurable via `blockClass`), **when** recording runs, **then** those subtrees are excluded from replay (rrweb `blockClass` / `ignoreClass` equivalent).

6. **Given** console output at `log`, `warn`, and `error` levels during recording, **when** buffer snapshot is exported, **then** console events captured via `@rrweb/rrweb-plugin-console-record` are included in the export payload (not only DOM events).

7. **Given** `fetch` and `XMLHttpRequest` traffic during recording, **when** network plugin captures requests, **then** `@rrweb/rrweb-plugin-network-record` records request/response metadata; **and** `Authorization` header values and cookie values are redacted before storage; **and** request and response bodies are truncated to **32 KB** (`32_768` bytes) each per architecture §4 payload caps and FR-2.

8. **Given** ingest endpoint URLs (default pattern: paths matching `/api/v1/capture/*` and configurable `ignoreRequestFn`), **when** the SDK would record its own upload traffic, **then** those requests are excluded via network plugin `ignoreRequestFn` to prevent feedback loops (FR-2).

9. **Given** a running recorder, **when** `exportBufferSnapshot({ seconds?: number })` (or equivalent public API on capture-core) is called, **then** it returns a structured payload containing: gzipped-or-ready-to-gzip replay events batch, console events slice, network events slice, `exportedAt` ISO timestamp, and `bufferSeconds` used; **and** the replay portion is the primitive E1-S3/E2-S2 will upload (no HTTP calls in this story).

10. **Given** `packages/capture-core` unit tests with `happy-dom` or `jsdom` test environment, **when** `bun test packages/capture-core` runs, **then** tests cover: buffer rotation/eviction, header/cookie redaction, 32 KB body cap, default input masking, `ignoreRequestFn` exclusion, and snapshot export shape; **and** `bunx turbo run lint typecheck test build` passes for the workspace.

11. **Out of scope for this story:** SDK `init()` / `submit()` public API (`packages/sdk` — E1-S4), screenshot/metadata capture (E1-S3), client gzip batching for upload (E1-S3), presign/inline ingest HTTP wiring (E2-S2), shadow DOM widget (E1-S5), npm publish of `@usebugreport/browser`, rrweb-player replay UI (E3-S7).

## Tasks / Subtasks

- [x] Task 1 — Dependencies and capture-core module layout (AC: 3, 11)
  - [x] Add `rrweb` 2.x, `@rrweb/rrweb-plugin-console-record`, `@rrweb/rrweb-plugin-network-record` to `packages/capture-core/package.json` (record-only plugins; no replay plugins in capture-core)
  - [x] Add `happy-dom` (preferred) or `jsdom` as devDependency for browser-like unit tests
  - [x] Create module files per epic: `src/record.ts`, `src/plugins/console.ts`, `src/plugins/network.ts`, `src/privacy/mask.ts`, `src/buffer/circular-buffer.ts`, `src/types.ts`, `src/export.ts`
  - [x] Replace stub `CAPTURE_CORE_VERSION` export in `src/index.ts` with typed public exports: `createRecorder`, `exportBufferSnapshot`, config types, stop/dispose helpers
  - [x] Keep `packages/sdk` as thin re-export stub only — no init/submit API yet (E1-S4)

- [x] Task 2 — Circular replay buffer (AC: 1, 2, 3, 9)
  - [x] Implement `createRecorder(options)` wrapping `record()` from `rrweb` with `emit(event, isCheckout)` feeding a circular segment store
  - [x] Configure `checkoutEveryNms` derived from `bufferSeconds` (e.g. segment length = min(bufferSeconds, 60_000) ms or half-window — document chosen strategy in code comment)
  - [x] Evict segments older than `bufferSeconds` wall time; enforce max in-memory event count guard as secondary bound
  - [x] Implement `exportBufferSnapshot({ seconds? })` returning replay events for last N seconds (default: full retained window), merged across checkout segments per rrweb checkout recipe
  - [x] Export TypeScript types for snapshot payload (`ReplaySnapshot`, `CaptureCoreConfig`)

- [x] Task 3 — Privacy defaults (AC: 4, 5)
  - [x] Implement `buildPrivacyOptions(config)` in `src/privacy/mask.ts` mapping to rrweb `maskAllInputs`, `maskInputOptions`, `maskTextSelector`, `blockClass`, `ignoreClass`
  - [x] Defaults: mask password + credit-card patterns; `blockClass: 'ubr-block'` (overridable); accept `maskSelectors: string[]` for custom CSS selectors
  - [x] Unit tests: password field masked, custom selector masks text, blocked subtree produces no sensitive node snapshots

- [x] Task 4 — Console plugin (AC: 6)
  - [x] Wire `@rrweb/rrweb-plugin-console-record` in `src/plugins/console.ts`; limit levels to `log`, `warn`, `error` (configure plugin level filter if supported)
  - [x] Accumulate console plugin events in buffer store alongside DOM events or separate console slice keyed for export
  - [x] Test: `console.warn('test')` during recording appears in exported snapshot

- [x] Task 5 — Network plugin + redaction (AC: 7, 8)
  - [x] Wire `@rrweb/rrweb-plugin-network-record` in `src/plugins/network.ts`
  - [x] Apply body size cap 32 KB per request/response via plugin config or post-process hook in capture-core
  - [x] Redact `Authorization` header and cookie values (replace with `[REDACTED]`) before buffer storage
  - [x] Default `ignoreRequestFn`: skip URLs matching `/api/v1/capture/` and allow integrator override
  - [x] Tests: auth header redacted, body truncated at 32 KB, ingest URL ignored

- [x] Task 6 — Verification gate (AC: 10)
  - [x] Add comprehensive `src/**/*.test.ts` suite under happy-dom/jsdom
  - [x] Run verification commands in Testing Requirements; ensure turbo graph still green

## Dev Notes

### Goal

Queue position **#9** in sprint plan — first **functional capture** story. Delivers browser-side Instant Replay circular buffer, console/network plugins with privacy redaction, and a **snapshot export primitive** inside `@usebugreport/capture-core`. E1-S3 adds screenshot/metadata + gzip bundling; E1-S4 exposes `init()`/`submit()` on `@usebugreport/browser`; E2-S2 uploads exported blobs.

### Scope boundary (critical)

| In E1-S2 | Deferred |
| --- | --- |
| rrweb circular buffer + checkout segmentation | SDK public `init()` / `submit()` (E1-S4) |
| Console + network official plugins | Screenshot + environment metadata (E1-S3) |
| Privacy masks, block class, custom selectors | Client gzip upload batching (E1-S3) |
| `exportBufferSnapshot()` typed payload | Presign/complete/inline HTTP (E2-S2) |
| capture-core unit tests (happy-dom/jsdom) | Shadow DOM widget (E1-S5) |
| Dependency additions in capture-core only | npm publish / `"private": false` (E1-S4) |

**Do not touch:** `apps/api` ingest routes, `packages/services`, `apps/web` replay viewer, `_bmad-output/` (except this story + sprint-status), harness files.

### Current repo state (main @ 0a72b63 — modify these)

| Path | Current state | This story changes |
| --- | --- | --- |
| `packages/capture-core/src/index.ts` | exports `CAPTURE_CORE_VERSION = "0.0.0-stub"` | real capture-core public API |
| `packages/capture-core/src/index.test.ts` | trivial version assertion | replace/extend with buffer/redaction tests |
| `packages/capture-core/package.json` | no rrweb deps; `"private": true` | add rrweb + plugins + happy-dom devDep |
| `packages/sdk/src/index.ts` | re-exports `CAPTURE_CORE_VERSION` stub | may re-export new capture-core types if needed for compile; **no init/submit** |
| `packages/sdk/package.json` | depends on capture-core only | unchanged unless type re-exports require build order tweak |

Epic E4 (auth/RBAC) is **complete** — no auth coupling in this story. E2-S1 ingest schema exists for awareness (`report_blobs.type` includes `replay`, `console`, `network`) but no server integration here.

### Architecture anchors (must follow)

| Anchor | Requirement |
| --- | --- |
| FR-1 | 120s default buffer; 30–120s configurable; circular retention |
| FR-2 | mask password/CC inputs; redact auth headers + cookies; 32 KB network bodies; `ignoreRequestFn` for ingest |
| §4 Payload caps | Network body 32 KB; instant replay buffer 120s default (30–120 configurable) |
| §2 Dependency direction | All capture logic in `packages/capture-core`; `packages/sdk` → capture-core; packages ↛ apps |
| §13 Testing | SDK layer: `bun test` for capture-core buffer, redaction |
| §15 E1 map | `packages/capture-core`, `packages/sdk` |
| ARCHITECTURE-SPINE Stack | rrweb + official plugins **2.x** |
| AD-4 (future) | Export primitive feeds async ingest — no upload in this story |

### Target file tree (capture-core)

```text
packages/capture-core/
├── package.json          # + rrweb, console/network record plugins, happy-dom
├── tsconfig.json         # unchanged pattern
└── src/
    ├── index.ts          # public exports
    ├── types.ts          # CaptureCoreConfig, ReplaySnapshot, etc.
    ├── record.ts         # createRecorder, start/stop, wires rrweb + plugins
    ├── export.ts         # exportBufferSnapshot()
    ├── buffer/
    │   └── circular-buffer.ts   # checkout segment store + eviction
    ├── plugins/
    │   ├── console.ts
    │   └── network.ts
    ├── privacy/
    │   └── mask.ts
    └── __tests__/        # or co-located *.test.ts
        ├── buffer.test.ts
        ├── redaction.test.ts
        └── privacy.test.ts
```

### Recommended config shape (capture-core internal — E1-S4 will mirror)

Align with PRD addendum SDK init shape; implement as `CaptureCoreConfig` now:

```typescript
type CaptureCoreConfig = {
  bufferSeconds?: number;           // default 120, clamp 30–120
  captureConsole?: boolean;         // default true
  captureNetwork?: boolean;         // default true
  networkBodyMaxBytes?: number;     // default 32_768
  maskSelectors?: string[];
  blockClass?: string;              // default 'ubr-block'
  ignoreRequestFn?: (url: string) => boolean;
};
```

Default `ignoreRequestFn` should return `true` for URLs containing `/api/v1/capture/` (presign, complete, ingest paths per architecture §4).

### rrweb implementation guidance

**Circular buffer pattern** (from [rrweb checkout docs](https://rrweb.com/docs/guide#checkout)):

- Maintain `eventsMatrix: eventWithTime[][]` — push new `[]` on `isCheckout`, shift oldest when wall-time window exceeded.
- Set `checkoutEveryNms` to a fraction of buffer window (e.g. 30_000–60_000 ms) so export merges last 1–2 segments for complete replay.
- On export, concatenate segments covering the requested seconds window; include initial full snapshot from oldest retained segment.

**Plugins** (from [plugin API](https://rrweb.com/docs/recipes/plugin-api)):

| Package | Purpose |
| --- | --- |
| `rrweb` | `record()` core |
| `@rrweb/rrweb-plugin-console-record` | console log/warn/error |
| `@rrweb/rrweb-plugin-network-record` | fetch/XHR; supports `ignoreRequestFn` |

Use ESM imports (`import { record } from 'rrweb'` or package subpath per installed version — verify in `node_modules` after install). Pin compatible 2.x versions in `package.json`; record resolved versions in lockfile.

**Browser guard:** `createRecorder` must no-op or throw clear error when `typeof window === 'undefined'` — capture-core is browser-only; tests use happy-dom to provide `window`/`document`.

### Snapshot export contract (E1-S3/E2-S2 consumer)

Export API should return a stable shape (names illustrative — use consistent naming in code):

```typescript
type BufferSnapshot = {
  exportedAt: string;              // ISO-8601
  bufferSeconds: number;
  replay: {
    events: eventWithTime[];       // rrweb events for replay tab
    eventCount: number;
  };
  console: {
    events: unknown[];             // plugin-specific console events
  };
  network: {
    events: unknown[];             // redacted, capped network events
  };
};
```

E1-S3 will add `screenshot`, `metadata`, and gzip bundling. E2-S2 maps `replay` → R2 `replay/batch-{seq}.json.gz`, `console` → `console.json.gz`, `network` → `network.json.gz` per architecture §7.

### Privacy redaction implementation notes

| Data | Default behavior |
| --- | --- |
| Password inputs | Masked via rrweb input masking |
| Credit-card fields | Mask via `maskSelectors` for `[autocomplete="cc-number"]`, `input[name*="card"]`, etc. |
| Custom selectors | Append integrator `maskSelectors` to rrweb mask config |
| `Authorization` header | Replace value with `[REDACTED]` in network events |
| Cookies | Redact cookie header values in network capture |
| Request/response body | Truncate to 32_768 bytes with explicit truncation marker if feasible |

### Testing Requirements

Run from repo root after implementation:

```bash
bun install
bun test packages/capture-core
bunx turbo run lint typecheck test build --filter=@usebugreport/capture-core...
bunx biome check packages/capture-core
```

**Test environment setup:**

- Prefer `happy-dom` with `@happy-dom/global-registrator` in test preload, or `jsdom` if happy-dom gaps with rrweb
- Use fake timers (`vi.useFakeTimers()` or Bun equivalent) for buffer eviction tests
- Avoid live network; mock `fetch` in network plugin tests
- If rrweb record requires full browser APIs not in happy-dom, isolate redaction/buffer logic in pure functions tested without full record, and keep 1–2 integration-style tests gated/skipped with comment

**Minimum test cases:**

1. Default `bufferSeconds` is 120; rejects/clamps 10 and 200
2. After simulated 90s with 60s buffer, export spans ≤60s
3. Authorization header redacted in stored network event
4. 40 KB body truncated to 32 KB
5. Ingest URL excluded by default `ignoreRequestFn`
6. Password input value not present in exported replay events (masked)
7. `exportBufferSnapshot` returns all three slices (replay, console, network)

### Anti-patterns (do not do)

- Do not add ingest HTTP calls, presign client, or `Idempotency-Key` handling — E2-S2
- Do not implement `init()` / `submit()` or publish `@usebugreport/browser` — E1-S4
- Do not add screenshot (`html2canvas`) or metadata collectors — E1-S3
- Do not import from `apps/*` or `@usebugreport/services` in capture-core
- Do not add Mantine, Radix, or Next.js deps to capture-core
- Do not store full session unbounded — must evict outside buffer window
- Do not skip redaction because "tests are hard" — redaction is FR-2 launch gate (LG-1)

### Epic E1 cross-story context

| Story | Relationship |
| --- | --- |
| E1-S1 (done) | Monorepo + stub packages — build on `packages/capture-core` layout |
| **E1-S2 (this)** | Buffer + plugins + export primitive |
| E1-S3 | Screenshot, metadata, gzip bundle wrapping `exportBufferSnapshot` output |
| E1-S4 | Public SDK API `init()` / `submit()` consuming capture-core |
| E1-S5 | Widget UI calling SDK submit + E2 presign |

Parallel safe after E4-S1 per sprint plan — **E1-S2 has no E4 dependency**.

### Git intelligence (recent main)

Recent commits are E4-focused (RBAC, workspace API keys, harness docs). Capture packages untouched since E1-S1 scaffold — no conflicting capture patterns to merge. Follow E1-S1 conventions: strict TS, Biome lint, `bun test`, workspace `build` via tsc.

### Library / version requirements

| Library | Version | Notes |
| --- | --- | --- |
| `rrweb` | 2.x | ARCHITECTURE-SPINE; ESM primary |
| `@rrweb/rrweb-plugin-console-record` | match rrweb major | record side only |
| `@rrweb/rrweb-plugin-network-record` | match rrweb major | `ignoreRequestFn` for ingest exclusion |
| `happy-dom` | latest stable devDep | DOM for unit tests |

Do **not** add replay plugins (`*-replay`) to capture-core — replay is web app concern (E3-S7).

### Project Structure Notes

- Aligns with epic E01 technical notes and architecture §2 `capture-core/` layout
- Published package name remains `@usebugreport/browser` in `packages/sdk` — still `"private": true` until E1-S4
- Keep helpers local until second consumer — buffer eviction and redaction can live in dedicated files above, not premature shared package

### References

- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E01-capture-sdk.md#Story E1-S2]
- [Source: _bmad-output/planning-artifacts/prds/prd-usebugreport-2026-07-20/prd.md#FR-1, FR-2]
- [Source: _bmad-output/planning-artifacts/prds/prd-usebugreport-2026-07-20/addendum.md#SDK Init Shape]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§4 Ingest, §13 Testing, §15 Epic map]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#Stack]
- [Source: _bmad-output/implementation-artifacts/1-1-monorepo-scaffold-and-capture-packages.md]
- [Source: _bmad-output/implementation-artifacts/sprint-plan-2026-07-20.md#Launch Queue position 9]
- [Source: https://rrweb.com/docs/guide#checkout]
- [Source: https://rrweb.com/docs/recipes/plugin-api]

## Definition of Done

- [x] All acceptance criteria verified via `bun test packages/capture-core` and turbo build/lint/typecheck
- [x] Circular buffer respects 30–120s configurable window with 120s default
- [x] Console, network plugins wired with redaction and 32 KB cap
- [x] `exportBufferSnapshot` returns replay + console + network slices
- [x] No ingest HTTP, widget UI, or npm publish changes
- [x] Story status moved to `review` by dev agent; code-review marks `done`

### Review Findings

**Verdict: approved (done)** — 2026-07-20 code review (headless)

- [x] [Review][Patch] `@usebugreport/db#lint` Biome format on multiline `test()` — fixed in `packages/db/src/__tests__/workspace-api-keys-migration.test.ts`
- [x] [Review][Patch] Vendored network plugin missing MIT attribution — added license header to `packages/capture-core/src/vendor/rrweb-plugin-network-record.ts`
- [x] [Review][Patch] Flaky `exportBufferSnapshot shape` test (5s timeout under turbo) — removed external fetch, added 15s timeout
- [x] [Review][Patch] `@usebugreport/browser#lint` export sort + test import format — fixed in `packages/sdk/src/index.ts` and `index.test.ts`
- [x] [Review][Defer] Console/network event arrays have no max-count guard (replay has `MAX_REPLAY_EVENT_COUNT`) — defer to E1-S3 if telemetry storms become a concern [`packages/capture-core/src/record.ts`]
- [x] [Review][Defer] Response-body 32 KB cap not isolated in tests (request path covered; `sanitizeNetworkRequest` applies same helper to both) [`packages/capture-core/src/plugins/redaction.test.ts`]

**Vendored file verification:** `bun pm view @rrweb/rrweb-plugin-network-record` → npm 404 (package unpublished). Vendor dir excluded from Biome lint/format via `biome.jsonc` override (not repo-wide disable).

**Verification:** `bun test packages/capture-core` 22 pass; `bunx turbo run lint typecheck build test` all green.

## Dev Agent Record

### Agent Model Used

Composer 2.5 (bmad-dev-story headless subagent)

### Debug Log References

- `@rrweb/rrweb-plugin-network-record` returns npm 404 at 2.1.0 — vendored official source at `src/vendor/rrweb-plugin-network-record.ts`
- Full monorepo turbo lint fails on `@usebugreport/db#lint` (pre-existing on main); capture-core graph green

### Completion Notes List

- Implemented `createRecorder` / `exportBufferSnapshot` with checkout-segmented circular buffer (120s default, 30–120 clamp/strict), console plugin (log/warn/error), network capture with auth/cookie redaction, 32 KB body cap, ingest URL exclusion
- 22 happy-dom tests pass covering buffer eviction, redaction, privacy defaults, export shape, console/network capture
- `bun test packages/capture-core`: 22 pass; `turbo lint typecheck build test --filter=@usebugreport/capture-core...`: all green

### File List

- biome.jsonc
- bun.lock
- packages/capture-core/bunfig.toml
- packages/capture-core/package.json
- packages/capture-core/tsconfig.json
- packages/capture-core/src/index.ts
- packages/capture-core/src/types.ts
- packages/capture-core/src/record.ts
- packages/capture-core/src/export.ts
- packages/capture-core/src/buffer/circular-buffer.ts
- packages/capture-core/src/buffer/buffer.test.ts
- packages/capture-core/src/plugins/console.ts
- packages/capture-core/src/plugins/network.ts
- packages/capture-core/src/plugins/redaction.test.ts
- packages/capture-core/src/privacy/mask.ts
- packages/capture-core/src/privacy/privacy.test.ts
- packages/capture-core/src/test/preload.ts
- packages/capture-core/src/vendor/rrweb-plugin-network-record.ts
- packages/capture-core/src/index.test.ts (deleted)
- packages/db/src/__tests__/workspace-api-keys-migration.test.ts
- packages/sdk/src/index.ts
- packages/sdk/src/index.test.ts

## Change Log

- 2026-07-20: E1-S2 capture-core instant replay buffer, privacy plugins, export primitive (review)
- 2026-07-20: code review approved — db lint fix, vendor MIT header, flaky test + browser lint fixes; status done
