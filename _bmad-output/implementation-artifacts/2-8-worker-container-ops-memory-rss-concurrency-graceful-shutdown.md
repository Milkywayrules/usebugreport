---
baseline_commit: 56a0cd2
depends_on:
  - 2-4-ingest-finalize-worker
---

# Story 2.8: Worker container ops — memory, RSS concurrency, graceful shutdown

Status: review

## Story

As a platform operator,
I want the worker container to respect memory limits and drain queues on shutdown,
so that ingest jobs are not lost during deploys.

## Acceptance Criteria

1. **Given** `docker-compose.prod.yml` worker service, **when** deployed, **then** memory limit 2 GB, reservation 1 GB, and `stop_grace_period: 130s`.
2. **Given** startup RSS probe, **when** RSS > 70% of limit, **then** ingest concurrency halves (min 1).
3. **Given** `SIGTERM`, **when** signal received, **then** workers drain up to 120s and exit 0.
4. **Given** job failures, **when** logged, **then** JSON logs include trace/org/report ids without r2 keys or presigned URLs.

## Tasks / Subtasks

- [x] RSS-aware concurrency helper + tests
- [x] Graceful shutdown with drain timeout
- [x] Structured worker logging on failures and Redis errors
- [x] docker-compose.prod worker memory + grace period
