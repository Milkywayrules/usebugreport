---
baseline_commit: 5a9a69c
depends_on:
  - 1-2-instant-replay-buffer-and-privacy-plugins
blocks:
  - 1-4-publishable-usebugreport-browser-sdk-package
---

# Story 1.3: screenshot and environment metadata at submit

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an integrator,
I want full-page or viewport WebP screenshot plus environment metadata attached on submit,
so that reports include visual and context data agents can consume (FR-3).

## Acceptance Criteria

1. **Given** a running recorder and submit-time assembly is invoked, **when** `assembleSubmitPayload(recorder, options?)` runs (or equivalent public API), **then** it returns a structured payload built on top of the existing `BufferSnapshot` from `exportBufferSnapshot` / `recorder.exportSnapshot()`; **and** the payload includes gzipped-ready parts for replay, console, and network plus a WebP screenshot blob and JSON environment metadata (FR-1 gzip consequence, FR-3).

2. **Given** default configuration (`captureScreenshot: true`, `screenshotMode: 'viewport'`), **when** submit payload is assembled in a browser environment, **then** `screenshot` is a `Blob` with MIME type `image/webp` (or `Uint8Array` + explicit `contentType: 'image/webp'` if using byte arrays — pick one shape and document it); **and** screenshot dimensions reflect viewport size × device pixel ratio.

3. **Given** `screenshotMode: 'fullPage'`, **when** submit payload is assembled, **then** the captured image includes scrollable content below the fold (full document height), subject to browser/DOM emulation limits documented in tests.

4. **Given** `captureScreenshot: false`, **when** submit payload is assembled, **then** `screenshot` is `null` or omitted per typed contract; **and** replay/console/network/metadata gzip parts are still produced.

5. **Given** privacy defaults from E1-S2 (`blockClass: 'ubr-block'`, `maskAllInputs`, credit-card selectors, integrator `maskSelectors`), **when** screenshot capture runs, **then** blocked subtrees are excluded or obscured and masked inputs do not leak plaintext values in the screenshot (reuse `buildPrivacyOptions` selectors / blockClass — do not invent a parallel mask list).

6. **Given** a browser at submit time, **when** `collectEnvironmentMetadata()` runs, **then** the returned JSON includes at minimum: `url`, `referrer`, `viewport` (`width`, `height`), `devicePixelRatio`, `userAgent`, `timestamp` (ISO-8601), `locale`, `timezone` (IANA string, e.g. `Intl.DateTimeFormat().resolvedOptions().timeZone`), and parsed `browser` + `os` fields derived from UA (and UA Client Hints when `navigator.userAgentData` is available); **and** optional integrator hook values merge in without overwriting system fields unless explicitly namespaced.

7. **Given** integrator registers metadata via `registerMetadataProvider(fn)` or config `metadataProvider: () => ({ userId, releaseId, ... })`, **when** submit payload is assembled, **then** hook return values are shallow-merged into `metadata.custom` (or equivalent nested key); **and** `userId` / `releaseId` remain addressable for E2 ingest → `reports.environment` jsonb (architecture §3 `environment` column).

8. **Given** replay/console/network slices from E1-S2, **when** gzip batching runs client-side inside capture-core, **then** each slice is compressed to gzip (`application/gzip`) using a browser-native approach (`CompressionStream` preferred — no Node-only APIs in capture-core); **and** output parts are named consistently for E2 upload mapping: `replay` → `replay/batch-{seq}.json.gz`, `console` → `console.json.gz`, `network` → `network.json.gz`, `meta` → `meta.json`, `screenshot` → `screenshot.webp` (logical part names only — no HTTP/R2 keys assigned client-side).

9. **Given** `packages/capture-core` unit tests with happy-dom, **when** `bun test packages/capture-core` runs, **then** tests cover: metadata collector field presence and merge behavior, submit payload assembly shape, gzip part content-types, `captureScreenshot: false` path, and privacy hook wiring; **and** screenshot tests document happy-dom limitations (canvas/WebP/toBlob may be stubbed — assert call contract + fallback/error path rather than pixel fidelity); **and** `bunx turbo run lint typecheck test build --filter=@usebugreport/capture-core...` passes.

10. **Out of scope for this story:** presign/complete/inline ingest HTTP (`apps/api`, E2-S2+), SDK public `init()` / `submit()` (`packages/sdk`, E1-S4), shadow DOM widget (E1-S5), npm publish, R2 upload wiring, `Idempotency-Key` header handling, server-side `CaptureIngestService` changes.

## Tasks / Subtasks

- [x] Task 1 — Extend types and config (AC: 1, 4, 7)
  - [x] Extend `CaptureCoreConfig` in `packages/capture-core/src/types.ts`: `captureScreenshot?: boolean` (default `true`), `screenshotMode?: 'viewport' | 'fullPage'` (default `'viewport'`), `metadataProvider?: () => Record<string, unknown>`
  - [x] Add `EnvironmentMetadata`, `ScreenshotCaptureResult`, `GzipBlobPart`, `CaptureSubmitPayload` types — extend or wrap existing `BufferSnapshot` (see Dev Notes contract)
  - [x] Export new types from `src/index.ts`

- [x] Task 2 — Environment metadata collector (AC: 6, 7)
  - [x] Create `packages/capture-core/src/metadata.ts` with `collectEnvironmentMetadata(options?)` and optional module-level `registerMetadataProvider` / provider passed via config
  - [x] Parse browser/OS from UA; enrich with `navigator.userAgentData` brands/platform when available
  - [x] Include `connection`/`effectiveType` when `navigator.connection` exists (optional field — do not fail if missing)
  - [x] Unit tests in `src/metadata.test.ts`: all required keys, custom merge, system-field protection

- [x] Task 3 — Screenshot capture (AC: 2, 3, 4, 5)
  - [x] Create `packages/capture-core/src/screenshot.ts` with `captureScreenshot(options)` using DOM-to-canvas approach
  - [x] Add dependency: prefer `html-to-image` (`toCanvas` + canvas `toBlob('image/webp')`) — architecture research allows `html2canvas`; choose `html-to-image` for smaller bundle and active maintenance unless happy-dom compatibility fails (document choice in code comment)
  - [x] Apply privacy: pass `filter`/`onclone` hooks to skip or mask `blockClass` subtrees and elements matching mask selectors; mirror E1-S2 `buildPrivacyOptions` inputs
  - [x] Respect `captureScreenshot: false` → return `null` without throwing
  - [x] Unit tests in `src/screenshot.test.ts`: config flag, filter invoked, happy-dom limitation note in test header comment

- [x] Task 4 — Submit payload assembly + gzip (AC: 1, 8)
  - [x] Create `packages/capture-core/src/submit-payload.ts` (or extend `export.ts` if smaller) with `assembleSubmitPayload(recorder, options?)`
  - [x] Internally call `recorder.exportSnapshot()` — do not duplicate buffer logic
  - [x] Implement `gzipJson(value: unknown): Promise<Blob>` (or sync if CompressionStream allows) helper local to this module
  - [x] Split replay events into batch parts if needed for large payloads (single batch seq `0` acceptable for v1 — document max size awareness; E2 handles multipart >5 MB)
  - [x] Tests in `src/submit-payload.test.ts`: part keys, gzip magic bytes (`0x1f 0x8b`), metadata JSON round-trip, null screenshot path

- [x] Task 5 — Verification gate (AC: 9)
  - [x] Run verification commands in Testing Requirements
  - [x] Bump `CAPTURE_CORE_VERSION` patch minor appropriately (e.g. `0.2.0`)

## Dev Notes

### Goal

Queue position **#10** in sprint plan — layers screenshot, environment metadata, and client-side gzip bundling on E1-S2's `BufferSnapshot` export primitive. Produces the **submit payload structure** E1-S4 (`init`/`submit`) and E2-S2 (presign/inline upload) will consume. No network I/O in this story.

### Scope boundary (critical)

| In E1-S3 | Deferred |
| --- | --- |
| WebP screenshot at submit (viewport/fullPage) | SDK `init()` / `submit()` public API (E1-S4) |
| Environment metadata collector + `metadataProvider` hook | Presign/complete/inline HTTP (E2-S2+) |
| Extend export → `CaptureSubmitPayload` with gzip parts | Shadow DOM widget (E1-S5) |
| `captureScreenshot: false` config | R2 upload / server `CaptureIngestService` |
| Privacy-aligned screenshot masking | npm publish (`@usebugreport/browser`) |
| capture-core unit tests (happy-dom) | rrweb-player replay UI (E3-S7) |

**Do not touch:** `apps/api`, `apps/worker`, `packages/services`, `packages/storage`, `apps/web`, `_bmad-output/` (except this story + sprint-status), harness files.

### Current repo state (main @ 5a9a69c — modify these)

| Path | Current state | This story changes |
| --- | --- | --- |
| `packages/capture-core/src/types.ts` | `BufferSnapshot` with `replay`, `console`, `network`, `exportedAt`, `bufferSeconds` | add screenshot/metadata/submit payload types + config flags |
| `packages/capture-core/src/export.ts` | re-exports `exportBufferSnapshot` from `record.ts` | may co-export `assembleSubmitPayload` |
| `packages/capture-core/src/record.ts` | `createRecorder`, `exportSnapshot` → `BufferSnapshot` | optional: expose resolved config to screenshot/metadata helpers; avoid breaking E1-S2 API |
| `packages/capture-core/src/privacy/mask.ts` | `buildPrivacyOptions` for rrweb | reuse selectors/blockClass for screenshot filter |
| `packages/capture-core/src/index.ts` | exports recorder + buffer types; `CAPTURE_CORE_VERSION = "0.1.0"` | export new APIs + version bump |
| `packages/capture-core/package.json` | rrweb 2.x, happy-dom; no screenshot lib | add `html-to-image` (or justified alternative) |
| `packages/sdk/src/index.ts` | re-exports capture-core; stub `SDK_VERSION` | type re-exports only if needed; **no init/submit** |

E1-S2 delivered (commit `5a9a69c`): circular buffer, console/network plugins, redaction, `exportBufferSnapshot`, vendored network plugin, 22 happy-dom tests.

### Real `BufferSnapshot` shape (E1-S2 — extend, do not replace)

```typescript
// packages/capture-core/src/types.ts (actual)
interface BufferSnapshot {
  bufferSeconds: number;
  console: { events: ConsoleSnapshotEvent[] };
  exportedAt: string;
  network: { events: NetworkSnapshotEvent[] };
  replay: { events: eventWithTime[]; eventCount: number };
}
```

E1-S3 adds a **submit envelope** wrapping snapshot + derived blobs — keep `BufferSnapshot` stable for E1-S2 regression tests.

### Recommended `CaptureSubmitPayload` contract (E1-S4/E2 consumer)

```typescript
type CaptureSubmitPayload = {
  /** ISO-8601 assembly time (may match snapshot.exportedAt) */
  assembledAt: string;
  bufferSeconds: number;
  /** Logical upload parts — E2 maps to presign PUT URLs / inline body */
  parts: {
    replay: GzipBlobPart[];      // [{ seq: 0, blob, contentType: 'application/gzip', byteLength }]
    console: GzipBlobPart;
    network: GzipBlobPart;
    meta: { json: EnvironmentMetadata; blob: Blob; contentType: 'application/json' };
    screenshot: { blob: Blob; contentType: 'image/webp'; byteLength: number } | null;
  };
  /** Raw snapshot retained for tests/debug; E2 may ignore */
  snapshot: BufferSnapshot;
};

type EnvironmentMetadata = {
  url: string;
  referrer: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  userAgent: string;
  browser: { name: string; version: string };
  os: { name: string; version?: string };
  locale: string;
  timezone: string;
  timestamp: string;
  connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  custom?: Record<string, unknown>;  // integrator metadataProvider / setMetadata hook
};
```

E2-S2 maps `parts.*` → R2 keys under `{orgId}/{projectId}/{reportId}/` per architecture §7; client sends logical sizes/content-types only.

### Architecture anchors (must follow)

| Anchor | Requirement |
| --- | --- |
| FR-3 | WebP screenshot + metadata (URL, viewport, DPR, UA, timestamp, custom hook) at submit |
| FR-1 consequence | Client-side gzip batching before upload |
| FR-2 (screenshot) | Same privacy masks as replay — blocked/masked content must not appear verbatim |
| §4 Payload caps | Network 32 KB (E1-S2); inline ingest ≤1 MB total (E2 — design screenshot WebP to stay reasonable; no hard cap in E1-S3 beyond documenting size field) |
| §7 R2 layout | `screenshot.webp`, `meta.json`, `console.json.gz`, `network.json.gz`, `replay/batch-{seq}.json.gz` |
| §13 Testing | SDK layer: `bun test` capture-core buffer, redaction, **gzip** |
| AD-4 | Blobs uploaded client-side in E2 — this story prepares bytes only, no BullMQ |
| Research §1.4 | Screenshot via DOM-to-canvas (`html2canvas` or equivalent); metadata at submit |

### Screenshot implementation guidance

**Library choice:** `html-to-image` (`toCanvas`, `toBlob`) preferred over `html2canvas` for bundle size; fallback to `html2canvas` only if happy-dom/WebP tests fail — document in PR if switched.

**Privacy alignment with E1-S2:**

| Mechanism | Replay (E1-S2) | Screenshot (E1-S3) |
| --- | --- | --- |
| `blockClass` / `ubr-block` | rrweb `blockClass` | `html-to-image` `filter(node)` excludes blocked subtrees |
| Password/CC masking | rrweb `maskAllInputs` + selectors | clone DOM in `onclone` — set `input.value = '***'` on masked nodes or overlay mask class |
| Custom `maskSelectors` | `maskTextSelector` | apply same selectors in clone pass |

**WebP encoding:** `HTMLCanvasElement.toBlob(cb, 'image/webp', quality)` with quality ~0.85 default; configurable constant, not integrator-facing in v1.

**Modes:**

| `screenshotMode` | Behavior |
| --- | --- |
| `viewport` | `document.documentElement` visible viewport only (default) |
| `fullPage` | full scrollable height via library `height`/`windowHeight` options |

### Metadata collector implementation notes

| Field | Source |
| --- | --- |
| `url` | `window.location.href` |
| `referrer` | `document.referrer` or `''` |
| `viewport.width/height` | `window.innerWidth/innerHeight` |
| `devicePixelRatio` | `window.devicePixelRatio` |
| `userAgent` | `navigator.userAgent` |
| `browser`, `os` | parse UA; prefer `navigator.userAgentData.getHighEntropyValues(['platform','platformVersion','fullVersionList'])` when available |
| `locale` | `navigator.language` |
| `timezone` | `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| `timestamp` | `new Date().toISOString()` at collection time |
| `custom.*` | `metadataProvider()` at assembly time |

**Hook API:** expose both config callback and `registerMetadataProvider(fn)` for E1-S4 `useBugReport.init({ metadata: () => ({...}) })` parity per PRD addendum SDK init shape.

**Do not collect:** cookies, localStorage, auth tokens, full request headers — FR-2 scope is network plugin only.

### Gzip batching

- Use Web `CompressionStream('gzip')` + `Blob` streams when `typeof CompressionStream !== 'undefined'`
- happy-dom may lack CompressionStream — test helper can use Bun `gzipSync` in test-only path OR skip gzip round-trip in happy-dom with `@test.skipIf(!globalThis.CompressionStream)` and document gap
- JSON serialize with `JSON.stringify` — no pretty-print (smaller blobs)
- Replay batch: single gzip blob of `{ events: eventWithTime[] }` or raw array — pick one, document for E2 worker parser (recommend `{ "events": [...] }` wrapper for forward compatibility)

### Testing Requirements

Run from repo root after implementation:

```bash
bun install
bun test packages/capture-core
bunx turbo run lint typecheck test build --filter=@usebugreport/capture-core...
bunx biome check packages/capture-core
```

**happy-dom screenshot limits (document honestly in test file header):**

- Canvas `toBlob('image/webp')` may return null or PNG fallback in happy-dom
- Prefer testing: (a) `captureScreenshot` calls filter/onclone with blocked node, (b) `captureScreenshot: false` returns null, (c) mock `html-to-image` module in unit tests for assembly path
- Do not claim pixel-perfect WebP validation in happy-dom

**Minimum test cases:**

1. `collectEnvironmentMetadata` returns all required keys with happy-dom defaults
2. `metadataProvider` merges into `custom` without overwriting `url`
3. `assembleSubmitPayload` includes `parts.replay`, `parts.console`, `parts.network`, `parts.meta`, `parts.screenshot`
4. Gzip parts start with magic bytes when CompressionStream available
5. `captureScreenshot: false` → `parts.screenshot === null`
6. Privacy filter excludes element with `ubr-block` class (mock DOM)
7. E1-S2 regression: existing 22 tests still pass unchanged

### Anti-patterns (do not do)

- Do not add fetch/XHR to presign/complete/ingest endpoints — E2-S2
- Do not implement `init()` / `submit()` in `packages/sdk` — E1-S4
- Do not assign R2 keys with org/project/report IDs client-side — server assigns in E2
- Do not break `BufferSnapshot` / `exportBufferSnapshot` signature used by E1-S2 tests
- Do not duplicate circular buffer or network redaction logic — call existing exports
- Do not use Node `zlib` in capture-core runtime code — browser bundle must stay portable
- Do not skip screenshot privacy because DOM cloning is tedious — FR-2 applies to screenshot surface

### Epic E1 cross-story context

| Story | Relationship |
| --- | --- |
| E1-S1 (done) | Monorepo scaffold |
| E1-S2 (done) | `BufferSnapshot`, `createRecorder`, privacy plugins |
| **E1-S3 (this)** | Screenshot + metadata + gzip submit payload |
| E1-S4 | Public SDK `init()`/`submit()` consuming `assembleSubmitPayload` |
| E1-S5 | Widget UI + E2 HTTP |

Parallel safe after E1-S2 per sprint plan — **no E4/E2 dependency**.

### Git intelligence (main @ 5a9a69c)

Latest capture commit: `5a9a69c feat: capture instant replay with privacy-first plugins` — establishes patterns to follow:

- Strict TS, Biome lint, happy-dom preload at `src/test/preload.ts`
- Vendored network plugin due to npm 404 — do not vendor screenshot libs unless same issue
- `createRecorder` throws outside browser; assembly APIs should same-guard
- Review deferral: console/network arrays lack max-count guard — optional cap in E1-S3 if submit payload size becomes concern (not required unless implemented trivially)

### Library / version requirements

| Library | Version | Notes |
| --- | --- | --- |
| `html-to-image` | latest stable 1.x | DOM → canvas → WebP; tree-shakeable ESM |
| `rrweb` / plugins | 2.x (existing) | unchanged |
| `happy-dom` | existing devDep | metadata tests primary; screenshot partial |

Do **not** add replay plugins, Mantine, or app-layer deps to capture-core.

### Project Structure Notes

- New files per epic: `src/screenshot.ts`, `src/metadata.ts`, `src/submit-payload.ts` (+ co-located `*.test.ts`)
- Keep gzip helper local to submit-payload until second consumer (YAGNI)
- `packages/sdk` may re-export types only — no behavioral API

### References

- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E01-capture-sdk.md#Story E1-S3]
- [Source: _bmad-output/planning-artifacts/prds/prd-usebugreport-2026-07-20/prd.md#FR-1, FR-3]
- [Source: _bmad-output/planning-artifacts/prds/prd-usebugreport-2026-07-20/addendum.md#SDK Init Shape, R2 Key Conventions]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§4 Ingest, §7 R2 layout, §13 Testing]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#AD-4]
- [Source: _bmad-output/planning-artifacts/research/technical-usebugreport-platform-architecture-research-2026-07-20.md#§1.4 Console, Network, Screenshots]
- [Source: _bmad-output/implementation-artifacts/1-2-instant-replay-buffer-and-privacy-plugins.md]
- [Source: packages/capture-core/src/types.ts — BufferSnapshot]
- [Source: packages/db/src/schema/ingest.ts — reports.environment jsonb]
- [Source: _bmad-output/implementation-artifacts/sprint-plan-2026-07-20.md#Launch Queue position 10]

## Dev Agent Record

### Agent Model Used

Composer (bmad-dev-story headless subagent)

### Debug Log References

- Completed existing WIP on `feat/screenshot-metadata`; no restart required
- Privacy screenshot uses detached DOM clone + `buildPrivacyOptions` selectors (html-to-image has no `onclone`; `filter` exported for integrator/tests)
- Test preload polyfills `CompressionStream` via Node `gzipSync` for happy-dom gzip round-trips

### Completion Notes List

- Extended `CaptureCoreConfig` / `BufferSnapshot` envelope with `CaptureSubmitPayload`, `EnvironmentMetadata`, `GzipBlobPart`, `ScreenshotCaptureResult`
- `collectEnvironmentMetadata` + `registerMetadataProvider` with UA parse, UA-CH enrichment, optional `navigator.connection`
- `captureScreenshot` via `html-to-image` `toCanvas` → WebP `toBlob`; privacy clone removes `ubr-block` and masks inputs/selectors
- `assembleSubmitPayload` gzips replay/console/network (`CompressionStream`), attaches meta JSON + optional screenshot; `recorder.getResolvedConfig()` added
- `CAPTURE_CORE_VERSION` bumped to `0.2.0`; SDK re-exports types + assembly APIs only (no init/submit)
- Verification: `bun test packages/capture-core` — 38 pass; `bunx turbo run lint typecheck build test` — 44/44 tasks pass

### File List

- `packages/capture-core/package.json`
- `packages/capture-core/src/types.ts`
- `packages/capture-core/src/record.ts`
- `packages/capture-core/src/export.ts`
- `packages/capture-core/src/index.ts`
- `packages/capture-core/src/metadata.ts`
- `packages/capture-core/src/metadata.test.ts`
- `packages/capture-core/src/screenshot.ts`
- `packages/capture-core/src/screenshot.test.ts`
- `packages/capture-core/src/submit-payload.ts`
- `packages/capture-core/src/submit-payload.test.ts`
- `packages/capture-core/src/test/preload.ts`
- `packages/sdk/src/index.ts`
- `packages/sdk/src/index.test.ts`
- `bun.lock`

### Review Findings

- [x] [Review][Defer] Missing fullPage mode integration test [packages/capture-core/src/screenshot.test.ts] — deferred; `fullPageHeight()` implemented but AC 3 height contract not asserted via mocked `toCanvas` options
- [x] [Review][Defer] UA parser labels Opera/CriOS as Chrome or unknown [packages/capture-core/src/metadata.ts:50] — deferred; acceptable v1 fallback, enrich later if ingest analytics need finer brands

## Change Log

- 2026-07-20: E1-S3 story context created (ready-for-dev)
- 2026-07-20: Implemented screenshot, environment metadata, gzip submit payload; status → review
- 2026-07-20: Code review passed (38 tests, turbo 4/4); status → done
