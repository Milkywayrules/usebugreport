---
baseline_commit: a2faaca
depends_on:
  - 1-1-monorepo-scaffold-and-capture-packages
  - 4-1-better-auth-github-oauth-and-session
blocks:
  - 4-6-usageservice-tier-limits-at-service-boundary-ad-11
  - 2-2-presign-and-complete-ingest-path
  - 2-3-inline-ingest-path-with-ack-latency-measurement
  - 2-4-ingest-finalize-worker
---

# Story 2.1: core ingest schema and queue payloads

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a backend engineer,
I want Drizzle schema for reports, blobs, and usage plus BullMQ reference-only payloads and an R2 storage client,
so that ingest metadata can persist and jobs enqueue without queue bloat (FR-5, AD-4, AD-9 foundation).

## Acceptance Criteria

1. **Given** migration `0001` applied on top of auth migration `0000`, **when** inspecting `packages/db/src/schema/`, **then** tables exist: `reports` (columns per architecture §3.1 including `ingest_status`, `idempotency_key`, generated `search_vector` per §3.3), `report_blobs`, `workspace_usage_monthly`; **and** enums cover report `status` (`open`, `in_progress`, `resolved`, `closed`, `duplicate`) and `ingest_status` (`pending`, `processing`, `complete`, `failed`).

2. **Given** the `reports` schema, **when** migration SQL is inspected, **then** a unique index exists on `(project_id, idempotency_key)` where `idempotency_key IS NOT NULL` (AD-5); **and** GIN index `reports_search_vector_idx` on `search_vector`; **and** btree index `reports_org_status_created_idx` on `(organization_id, status, created_at DESC)` per §3.3.

3. **Given** `reports.organization_id`, **when** FK constraints are defined, **then** they reference the existing better-auth `organization.id` from migration `0000` (additive — do not recreate auth tables); **and** `project_id` is stored as text (FK to `projects` deferred to E4-S3 — no `projects` table in this story).

4. **Given** `packages/queue` exports, **when** job payload types are inspected, **then** `ingest.finalize` payload is `{ reportId, r2Keys[], projectId, idempotencyKey }` only (Zod + exported TypeScript type); **and** stub payload schemas exist for other v1 queues (`webhooks.dispatch`, `deletion.*`, `retention.sweep`, `integrations.linear_push`) as refs-only Zod objects aligned with architecture §4 queue table.

5. **Given** CI or `bun test` in `packages/queue`, **when** payload source files are scanned, **then** no `Buffer` or `Uint8Array` appears in queue payload type definitions (ARCHITECTURE-SPINE system invariant; enforce via unit test grep/assertion).

6. **Given** `packages/queue`, **when** queue helpers are used, **then** exported queue name constants match architecture §4 (`ingest`, `webhooks`, `deletion`, `retention`, `integrations`); **and** a typed `createQueueConnection()` (or equivalent) factory reads `REDIS_URL` from `@usebugreport/config` — **no job processors** and no BullMQ Worker registration in this story.

7. **Given** `packages/storage`, **when** `createR2Client(env)` is called with validated R2 env vars, **then** an S3-compatible client targets Cloudflare R2; **and** helpers export `presignPut(key, contentType, expiresInSeconds?)` and `presignGet(key, expiresInSeconds?)` returning URL strings; **and** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` are used (architecture §7 R2 layout — key format `{orgId}/{projectId}/{reportId}/...` documented in dev notes, not enforced here).

8. **Given** `packages/config/src/env.ts`, **when** parsed, **then** R2 vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) and `REDIS_URL` remain validated (already stubbed in E1-S1 — ensure storage/queue consumers use them, no new secrets hardcoded).

9. **Given** additive migration discipline, **when** `bun run db:migrate` runs against a DB with `0000` already applied, **then** only `0001_*` ingest tables/indexes are added; auth tables from E4-S1 remain intact.

10. **Out of scope for this story:** HTTP ingest routes (`/api/v1/capture/*`), `CaptureIngestService`, ingest-key auth, rate limiting, quota checks (`UsageService` — E4-S6), `ingest.finalize` worker processor (`apps/worker/src/jobs/ingest.ts` — E2-S4), `ingest_keys` / `projects` CRUD tables (E4-S3), presign/complete business logic (E2-S2), inline ingest path (E2-S3), ReportService reads (E2-S5), Redis sliding-window rate limiter wiring (E2-S6).

## Tasks / Subtasks

- [x] Task 1 — Ingest Drizzle schema (AC: 1, 2, 3, 9)
  - [x] Add `packages/db/src/schema/ingest.ts` — `reports`, `report_blobs`, `workspace_usage_monthly` with pgEnums for report status + ingest status + blob type (`replay`, `screenshot`, `console`, `network`, `meta`)
  - [x] Implement `search_vector` as generated stored column via `customType` or migration SQL fragment matching §3.3 (`setweight` on `title`, `description`, `summary_text`)
  - [x] Export from `packages/db/src/schema/index.ts`; extend `packages/db/src/index.ts` `schema` object
  - [x] Generate migration `0001_*` via `drizzle-kit generate`; hand-verify SQL includes GIN index, unique partial index on `(project_id, idempotency_key)`, and `reports_org_status_created_idx`
  - [x] Confirm migration is additive — journal entry `0001` after `0000_perfect_dreaming_celestial`
- [x] Task 2 — Schema/migration tests (AC: 1, 2, 9)
  - [x] Replace `packages/db` `echo 'no tests'` with real `bun test` suite
  - [x] Add `packages/db/src/__tests__/ingest-migration.test.ts` — skip when `DATABASE_URL` unset; against Docker Postgres: run migrate, assert tables/indexes exist via `information_schema` / `pg_indexes`
  - [x] Add test seed helper inserting minimal `organization` row (reuse better-auth `organization` table) + synthetic `project_id` text on `reports` row (no `projects` FK)
  - [x] Document Docker warm-up: first `docker compose` invocation may take ~20s for daemon start — wait for `pg_isready` healthcheck
- [x] Task 3 — Queue definitions + invariant test (AC: 4, 5, 6)
  - [x] Refactor `packages/queue/src/index.ts` — separate `QUEUE_NAMES` (queue buckets) from `JOB_NAMES` (job identifiers per §4)
  - [x] Finalize `ingestFinalizePayloadSchema` fields; add/update Zod schemas for other v1 job payloads (refs-only shapes)
  - [x] Add `createRedisConnection()` / `getQueueOptions()` reading `REDIS_URL` from config; export typed `Queue` factory stubs (BullMQ 5.x) without Workers
  - [x] Add `packages/queue/src/__tests__/payload-invariant.test.ts` — assert no `Buffer`/`Uint8Array` in exported schema source (grep or AST walk)
  - [x] Replace `echo 'no tests'` in `packages/queue/package.json`
- [x] Task 4 — R2 storage client (AC: 7, 8)
  - [x] Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to `packages/storage`
  - [x] Replace stub in `packages/storage/src/index.ts` with `createR2Client({ accountId, accessKeyId, secretAccessKey, bucket })` using R2 endpoint `https://{accountId}.r2.cloudflarestorage.com`
  - [x] Export `presignPut` / `presignGet` helpers (default PUT TTL ~15 min for uploads, GET TTL 900s per AD-6 for future manifest use)
  - [x] Add unit tests with mocked S3 client (no live R2 required) verifying presigner called with expected bucket/key
  - [x] Replace `echo 'no tests'` in `packages/storage/package.json`
- [x] Task 5 — Verification gate (AC: all)
  - [x] Update `.env.example` if any new optional vars introduced (none expected — R2/Redis already listed)
  - [x] Run full verification commands in Testing Requirements
  - [x] Confirm `apps/worker` remains stub — no new job handlers

## Dev Notes

### Goal

Queue position **#3** in sprint plan — ingest **data layer** before E4-S6 (`workspace_usage_monthly` for UsageService) and E2-S2 (presign HTTP path). Delivers Postgres ingest schema, BullMQ typed queue contracts (refs-only), and R2 client wiring. **No HTTP, no workers, no services.**

### Scope boundary (critical)

| In E2-S1 | Deferred |
| --- | --- |
| `reports`, `report_blobs`, `workspace_usage_monthly` Drizzle + migration `0001` | `projects`, `ingest_keys`, `organizations` app billing columns (E4-S3/E4-S6) |
| FTS generated column + indexes (§3.3) | `SearchService` queries (E2-S5) |
| BullMQ queue names + Zod payload types | Job processors in `apps/worker` (E2-S4+) |
| R2 S3 client + presign helpers | Capture routes, `CaptureIngestService` (E2-S2/S3) |
| CI/test invariant: no blob bytes in queue payloads | Rate limits, quota enforcement (E2-S6, E4-S6) |
| Redis connection factory for queues | BullMQ Worker boot, concurrency, graceful shutdown (E2-S8) |

**E4-S3 coupling:** Production ingest requires `projects` + `ingest_keys` tables. This story stores `project_id` as text without FK so migration applies before E4-S3; integration tests seed a synthetic `project_id` string. E2-S2 presign path depends on E4-S3 for real ingest keys.

**E4-S6 coupling:** `workspace_usage_monthly` table must exist before UsageService tier stubs; increment logic stays in E2-S4 finalize worker + E4-S6 service.

### Current repo state (E4-S1 at HEAD — modify these)

| Path | Current state | This story changes |
| --- | --- | --- |
| `packages/db/src/schema/index.ts` | exports `./auth` only | add `./ingest` exports |
| `packages/db/src/index.ts` | schema = auth tables only | include ingest tables in schema object |
| `packages/db/migrations/` | `0000_perfect_dreaming_celestial.sql` (8 auth tables) | add `0001_*` ingest migration |
| `packages/db/package.json` | `test`: echo no tests | real bun tests |
| `packages/queue/src/index.ts` | Zod payload stubs; `QUEUE_NAMES` mixes job names | align queue vs job names; Redis factory; invariant test |
| `packages/storage/src/index.ts` | `{ status: "stub" }` placeholder | real R2 S3 client + presign helpers |
| `packages/config/src/env.ts` | R2 + Redis vars already in Zod schema | consumed by storage/queue (no structural change expected) |
| `apps/worker/src/index.ts` | imports `QUEUE_NAMES`, stub boot | **unchanged** (no processors) |
| `docker/docker-compose.dev.yml` | Postgres 16 + Redis 7 | use for migration/integration tests |

**Do not touch:** `apps/api` ingest routes, `packages/services` business logic, auth schema/migration `0000`, `_bmad-output/` (except this story file), harness/agent files.

### Architecture anchors (must follow)

| Anchor | Requirement |
| --- | --- |
| §3.1 `reports` | Columns: `id` (`rpt_*`), `organization_id`, `project_id`, `idempotency_key`, `title`, `description`, `status`, `reporter_label`, `environment` jsonb, `summary` jsonb, `summary_text`, `search_vector` generated, `linear_issue_*`, `ingest_status`, timestamps, `metadata_retention_until` |
| §3.1 `report_blobs` | `type` enum, `r2_key`, `size_bytes`, `seq`, `content_type`, `expires_at` |
| §3.1 `workspace_usage_monthly` | PK `(organization_id, year_month)`; `report_count` int default 0 |
| §3.3 FTS | Generated `search_vector` + GIN `reports_search_vector_idx` + btree `reports_org_status_created_idx` |
| §4 Ingest pipeline | BullMQ invariant: payloads `{ reportId, r2Keys[], projectId, idempotencyKey }` only — never blob bytes |
| §4 Queues | Queue buckets: `ingest`, `webhooks`, `deletion`, `retention`, `integrations`; job `ingest.finalize` on `ingest` queue |
| §7 R2 key layout | `{orgId}/{projectId}/{reportId}/replay/batch-{seq}.json.gz` etc. — storage helpers accept opaque keys; layout enforced in E2-S2+ |
| §17 Env | `R2_*`, `REDIS_URL`, `DATABASE_URL` via `@usebugreport/config` |
| AD-4 | R2-first durable ingest; queue refs-only (ARCHITECTURE-SPINE + §4) |
| AD-5 | Unique `(project_id, idempotency_key)` on reports |
| AD-9 | `workspace_usage_monthly` incremented on finalize complete (table now; logic E2-S4/E4-S6) |
| AD-7 | FTS generated column foundation (search service E2-S5) |

### Drizzle implementation hints

**Organization FK:** E4-S1 created better-auth `organization` table (not a separate `organizations` app table). Map architecture `organization_id` → FK to `organization.id`. App-level billing fields (`billing_tier`, retention overrides) arrive in E4-S6/E4-S3 — do not add them here.

**Generated `search_vector`:** Drizzle may not express `GENERATED ALWAYS AS ... STORED` cleanly — acceptable pattern: define column in schema with `.generatedAlwaysAs()` (Drizzle 0.38+) **or** emit raw SQL in migration for the generated column + indexes while keeping other columns in Drizzle. Must match §3.3 SQL exactly.

**Idempotency unique index:** Use partial unique index in migration:

```sql
CREATE UNIQUE INDEX reports_project_idempotency_uidx
  ON reports (project_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**Enum naming:** Prefer pgEnum in `ingest.ts` exported for reuse in E2-S2 services.

### Queue package structure (target)

```text
packages/queue/src/
  index.ts              # re-exports
  names.ts              # QUEUE_NAMES, JOB_NAMES
  payloads/
    ingest.ts           # ingestFinalizePayloadSchema
    webhooks.ts
    deletion.ts
    retention.ts
    integrations.ts
  connection.ts         # createRedisConnection from REDIS_URL
  __tests__/
    payload-invariant.test.ts
```

Keep flat exports from package root for backward compatibility with `apps/worker` stub import.

### Storage package structure (target)

```text
packages/storage/src/
  index.ts              # createR2Client, presignPut, presignGet
  r2.ts                 # S3 client config (endpoint, region 'auto')
  __tests__/
    presign.test.ts     # mocked S3
```

R2 client config:

```typescript
endpoint: `https://${accountId}.r2.cloudflarestorage.com`
region: "auto"
forcePathStyle: false
```

Never log presigned URLs or raw `r2_key` values (architecture §11 redaction invariant — apply in later stories; no logging in storage helpers here).

### Library versions (pin in package.json)

| Package | Version | Notes |
| --- | --- | --- |
| `drizzle-orm` | `^0.38.0` | existing in `@usebugreport/db` |
| `drizzle-kit` | `^0.31.x` | existing devDependency |
| `bullmq` | `^5.40.0` | existing in `@usebugreport/queue` |
| `@aws-sdk/client-s3` | `^3.x` | add to `@usebugreport/storage` |
| `@aws-sdk/s3-request-presigner` | `^3.x` | presigned PUT/GET |
| `zod` | `^3.24.0` | existing |

### Anti-patterns (do not do)

- Do not implement HTTP routes in `apps/api/src/routes/capture/`
- Do not add BullMQ Worker or `processFinalizeJob` in `apps/worker`
- Do not put blob bytes (`Buffer`, `Uint8Array`, base64 bodies) in queue payload types
- Do not recreate or alter auth migration `0000` tables
- Do not create `projects`, `ingest_keys`, or `CaptureIngestService` yet
- Do not implement UsageService increment/checkQuota (E4-S6 / E2-S6)
- Do not require live Cloudflare R2 for unit tests — mock S3 client
- Do not commit secrets or `.env.local`

### Previous story intelligence

**From E4-S1 (4-1-better-auth-github-oauth-and-session.md):**

- Migration naming: auth landed as `0000_perfect_dreaming_celestial.sql` — next must be `0001_*` additive
- Docker: `docker/docker-compose.dev.yml` with Postgres 16 credentials `usebugreport:usebugreport@localhost:5432/usebugreport`
- Integration tests skip unless `DATABASE_URL` explicitly set; pattern in `apps/api/src/__tests__/test-env.ts`
- `@better-auth/cli generate` produced auth schema — ingest schema is hand-authored Drizzle (do not run auth CLI over ingest tables)
- Review note: migration tests should invoke or assert post-`db:migrate` state clearly

**From E1-S1:** `packages/queue` and `packages/storage` were intentional stubs; `@usebugreport/services` depends on db/storage/queue — exporting stable types prevents downstream churn.

### Git intelligence (HEAD `a2faaca`)

Recent commits:

- `a2faaca` — E4-S1 better-auth, Drizzle auth schema, `0000` migration, web login, session probe
- `469411e` — E1-S1 turborepo scaffold, queue/storage stubs, env Zod schema

Patterns to continue: workspace packages, biome lint, turbo tasks, bun test, HEREDOC commits (verasic protocol).

### Project Structure Notes

New files (expected):

```text
packages/db/src/schema/ingest.ts
packages/db/src/__tests__/ingest-migration.test.ts
packages/db/migrations/0001_*.sql
packages/db/migrations/meta/0001_snapshot.json
packages/queue/src/names.ts
packages/queue/src/connection.ts
packages/queue/src/payloads/*.ts
packages/queue/src/__tests__/payload-invariant.test.ts
packages/storage/src/r2.ts
packages/storage/src/__tests__/presign.test.ts
```

Aligns with architecture §2 dependency direction: `packages/storage` + `packages/queue` → `@usebugreport/config`; `packages/db` standalone schema; **no** `apps/*` imports.

### References

- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E02-ingest-pipeline-storage.md#Story E2-S1]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#3. Data Model]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#3.3 Postgres FTS]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#4. Ingest Pipeline]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#7. Replay Storage & Serving — R2 key layout]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#13. Testing Strategy]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#17. Environment Variables]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#AD-4]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#AD-5]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#AD-9]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#System Invariants — BullMQ refs-only]
- [Source: _bmad-output/implementation-artifacts/4-1-better-auth-github-oauth-and-session.md]
- [Source: _bmad-output/implementation-artifacts/1-1-monorepo-scaffold-and-capture-packages.md]
- [Source: _bmad-output/implementation-artifacts/sprint-plan-2026-07-20.md#Launch Queue — position 3]

## Testing Requirements

Run from repo root after implementation; all must exit 0:

```bash
# Prerequisites — Docker daemon may need ~20s on first start in WSL/CI
docker compose -f docker/docker-compose.dev.yml up -d postgres
# Wait for health: pg_isready -U usebugreport -d usebugreport

export DATABASE_URL=postgresql://usebugreport:usebugreport@localhost:5432/usebugreport

bun install
bun run db:migrate                    # applies 0000 + 0001 on fresh DB; 0001 only if 0000 present
bunx biome check .
bunx turbo run lint typecheck test build

# Package-focused tests
DATABASE_URL="$DATABASE_URL" bun test packages/db/src/__tests__/
bun test packages/queue/src/__tests__/
bun test packages/storage/src/__tests__/
```

**Required integration coverage (`packages/db`):**

| Case | Expected |
| --- | --- |
| Fresh migrate on empty DB | Auth + ingest tables exist |
| Migrate on DB with `0000` only | `0001` applies without altering auth tables |
| `reports` indexes | GIN on `search_vector`; unique partial on `(project_id, idempotency_key)`; org/status/created index |
| Insert report row with org FK | Succeeds when `organization` row exists; synthetic `project_id` text |

**Required unit coverage:**

| Package | Case | Expected |
| --- | --- | --- |
| `packages/queue` | Payload invariant scan | No `Buffer`/`Uint8Array` in payload modules |
| `packages/queue` | Zod parse `ingestFinalizePayloadSchema` | Accepts sample refs-only object; rejects extra binary fields |
| `packages/storage` | Presign helpers (mocked S3) | Returns URL string; uses configured bucket + key |

**Not required this story:** Live R2 upload/download, Redis queue enqueue integration, HTTP ingest E2E, worker job processing, Playwright.

## Definition of Done

- [x] All acceptance criteria met
- [x] Migration `0001` applies additively on top of `0000` via `db:migrate`
- [x] `reports`, `report_blobs`, `workspace_usage_monthly` schema matches architecture §3.1/§3.3
- [x] Queue payload types are refs-only; invariant test passes
- [x] R2 client + presign helpers exported from `@usebugreport/storage`
- [x] `turbo lint typecheck test build` exit 0
- [x] No HTTP capture routes, no worker processors, no UsageService logic added
- [x] `.env.example` documents R2/Redis/Postgres (unchanged or updated); no secrets committed
- [x] Story status moved to `review` by dev agent; code-review marks `done`

## Dev Agent Record

### Agent Model Used

Composer 2.5 (subagent)

### Debug Log References

- Migration `0001_breezy_wendigo.sql` generated via drizzle-kit; verified GIN + partial unique + org/status/created indexes
- `ingestFinalizePayloadSchema` uses `.strict()` so extra binary fields fail parse (Zod strips unknown keys by default)
- Turbo does not pass `DATABASE_URL` to child tasks by default — db integration tests run via direct `bun test` with env set
- Docker compose down after verification per story instructions

### Completion Notes List

- Added ingest Drizzle schema (`reports`, `report_blobs`, `workspace_usage_monthly`) with pgEnums, FTS generated `search_vector`, organization FK, synthetic `project_id` text
- Migration `0001_breezy_wendigo` additive on `0000_perfect_dreaming_celestial`
- Queue package refactored: `QUEUE_NAMES` buckets + `JOB_NAMES`; refs-only Zod payloads; `createRedisConnection`/`createQueue` from config `REDIS_URL`
- Storage package: R2 S3 client + `presignPut`/`presignGet` (900s default TTL); mocked unit tests
- Integration tests pass against Docker Postgres when `DATABASE_URL` set (3/3 db, 3/3 queue, 3/3 storage)
- Full `turbo run lint typecheck build test --force` exit 0

### File List

- packages/db/src/schema/ingest.ts (new)
- packages/db/src/schema/index.ts (modified)
- packages/db/src/index.ts (modified)
- packages/db/migrations/0001_breezy_wendigo.sql (new)
- packages/db/migrations/meta/0001_snapshot.json (new)
- packages/db/migrations/meta/_journal.json (modified)
- packages/db/src/__tests__/ingest-migration.test.ts (new)
- packages/db/package.json (modified)
- packages/db/tsconfig.json (modified)
- packages/queue/src/names.ts (new)
- packages/queue/src/connection.ts (new)
- packages/queue/src/payloads/ingest.ts (new)
- packages/queue/src/payloads/webhooks.ts (new)
- packages/queue/src/payloads/deletion.ts (new)
- packages/queue/src/payloads/retention.ts (new)
- packages/queue/src/payloads/integrations.ts (new)
- packages/queue/src/index.ts (modified)
- packages/queue/src/__tests__/payload-invariant.test.ts (new)
- packages/queue/package.json (modified)
- packages/queue/tsconfig.json (modified)
- packages/storage/src/r2.ts (new)
- packages/storage/src/index.ts (modified)
- packages/storage/src/__tests__/presign.test.ts (new)
- packages/storage/package.json (modified)
- packages/storage/tsconfig.json (modified)
- bun.lock (modified)

## Change Log

- 2026-07-20: Story 2.1 created — ingest schema, queue payloads, R2 client foundation (ready-for-dev)
- 2026-07-20: Story 2.1 implemented — migration 0001, queue refs-only payloads, R2 presign client (review)
- 2026-07-20: Senior review APPROVED — all AC met, verification suite green

## Senior Review Record

**Verdict:** APPROVED  
**Reviewer:** BMad code-review (headless)  
**Reviewed:** 2026-07-20

### Acceptance Criteria Audit

| AC | Status | Evidence |
| --- | --- | --- |
| 1 | met | `ingest.ts` tables + enums; migration `0001_breezy_wendigo.sql` |
| 2 | met | GIN `reports_search_vector_idx`, partial unique `reports_project_idempotency_uidx`, btree `reports_org_status_created_idx` |
| 3 | met | FK to `organization.id`; `project_id` text without FK |
| 4 | met | `ingestFinalizePayloadSchema` strict refs-only; stub payloads for §4 queues |
| 5 | met | `payload-invariant.test.ts` — no Buffer/Uint8Array |
| 6 | met | `QUEUE_NAMES` buckets + `JOB_NAMES`; `createRedisConnection` via `parseEnv` |
| 7 | met | R2 client + presign helpers; 900s TTL; mocked unit tests |
| 8 | met | R2/Redis vars in `env.ts`; consumed by queue/storage |
| 9 | met | `0000` untouched; `0001` additive only |
| 10 | met | No HTTP routes, workers, or UsageService logic |

### Verification Results

| Command | Result |
| --- | --- |
| `docker compose up -d postgres` + `pg_isready` | healthy |
| `bun run db:migrate` | exit 0 (0000+0001) |
| `DATABASE_URL=... bun test packages/db packages/queue packages/storage` | 15 pass, 0 fail (db 3/3 ran, not skipped) |
| `bunx turbo run lint typecheck build test` | 44/44 tasks pass |
| `git diff packages/db/migrations/0000_*` | empty (0000 unmodified) |
| `docker compose down` | exit 0 |

### Review Findings

**Issues fixed during review:** none (no CRITICAL/HIGH findings)

- [ ] [Review][Note][medium] Stub payload schemas (webhooks, deletion, retention, integrations) omit `.strict()` — ingest has it; consider aligning in E2-S4 when processors wire up
- [ ] [Review][Note][medium] `turbo test` skips `packages/db` integration without `DATABASE_URL` in task env — CI must set Postgres + env (same convention as E4-S1)
- [ ] [Review][Note][low] No `(organization_id, project_id, created_at)` index — not in §3.3 for E2-S1; evaluate when ReportService list lands (E2-S5)
- [ ] [Review][Note][low] `updated_at` relies on Drizzle `$onUpdate` at ORM layer — no DB trigger in migration
