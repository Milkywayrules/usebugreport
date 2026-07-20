# Production deployment runbook

UseBugReport runs as three application processes (web, api, worker) backed by PostgreSQL, Redis, and Cloudflare R2. This document is the operator checklist for Coolify or any Docker-based host. **Do not commit real secrets** — inject them via the platform secret store (Coolify env, Doppler, Vault).

## Topology

| Service | Port | Role |
|---------|------|------|
| `web` | 3000 | Next.js app (`APP_URL`) |
| `api` | 3001 | Elysia API + auth + MCP (`API_URL`) |
| `worker` | — | BullMQ consumers (ingest finalize, webhooks, integrations, GDPR) |
| `postgres` | 5432 | Primary database |
| `redis` | 6379 | Queues + rate limits |

Reference compose stub: `docker/docker-compose.prod.yml` (images must be built and pushed before production use — Dockerfiles under `docker/` are still stubs).

## Pre-flight checklist

- [ ] PostgreSQL 16 reachable; `DATABASE_URL` set and migrations applied (`bun run db:migrate` from a release job or init container).
- [ ] Redis 7 reachable; `REDIS_URL` set.
- [ ] R2 bucket created; `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` set.
- [ ] `ENCRYPTION_KEY` — long random string (32+ chars); used for integration OAuth state and token encryption.
- [ ] `BETTER_AUTH_SECRET` — long random string (32+ chars).
- [ ] Public URLs: `APP_URL` (web origin), `API_URL` (api origin, used for OAuth callbacks and webhooks).
- [ ] Web client: `NEXT_PUBLIC_API_URL` must match browser-reachable `API_URL` (CORS + cookies).
- [ ] GitHub OAuth app: callback URL `{API_URL}/api/auth/callback/github` and integration callback `{API_URL}/api/v1/integrations/github/callback`; `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` on **api** (and worker if shared env).
- [ ] Linear OAuth: `{API_URL}/api/v1/integrations/linear/callback`; `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`; optional `LINEAR_WEBHOOK_SECRET` for inbound sync.
- [ ] Email (optional): `RESEND_API_KEY` on worker for transactional mail.
- [ ] Worker tuning: `WORKER_CONCURRENCY` (default 8), `WORKER_DRAIN_TIMEOUT_MS` (default 120000), `WORKER_MEMORY_LIMIT_MB` (default 2048).

Copy variable names from `.env.example` — values are placeholders only.

## Coolify notes

1. **Three services** from images `usebugreport/web`, `usebugreport/api`, `usebugreport/worker` (build pipeline TBD — see Dockerfiles).
2. **Shared env block** on api + worker + web where noted; web only needs `NEXT_PUBLIC_*` plus any server-side secrets Next reads at build/runtime.
3. **Worker graceful shutdown**: set container `stop_grace_period` ≥ 130s so in-flight jobs can finish (`WORKER_DRAIN_TIMEOUT_MS` default 120s).
4. **Worker memory**: reserve ≥ 1 GiB, limit ≥ 2 GiB (`mem_limit` / `mem_reservation` in compose stub).
5. **Health**: expose api HTTP on 3001; configure Coolify health check against a lightweight route once defined (today: process listen on `PORT`).
6. **Database**: managed Postgres preferred; do not expose 5432 publicly if using Coolify internal networking.

## Docker Compose (manual / staging)

```bash
# Build images (when Dockerfiles are wired)
docker build -f docker/Dockerfile.web -t usebugreport/web .
docker build -f docker/Dockerfile.api -t usebugreport/api .
docker build -f docker/Dockerfile.worker -t usebugreport/worker .

# Run stack (inject env via --env-file; never commit that file)
docker compose -f docker/docker-compose.prod.yml --env-file /path/to/production.env up -d
```

Run migrations once per release before turning traffic to new api/worker revisions.

## Release order

1. Migrate database.
2. Deploy **worker** (backward-compatible job handlers).
3. Deploy **api**.
4. Deploy **web** (if `NEXT_PUBLIC_*` changed, rebuild web image).

## Verification

- [ ] Sign in via GitHub OAuth on `APP_URL`.
- [ ] Create workspace / project; SDK ingest smoke test.
- [ ] Queue depth stable; worker logs show no repeated job failures.
- [ ] Linear/GitHub integration OAuth from workspace settings (admin).
- [ ] Pro-tier webhook delivery test from settings UI.

## Secrets hygiene

- Rotate `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` only with a documented migration (invalidates sessions and encrypted integration tokens).
- Use separate OAuth apps for staging vs production.
- Keep agent/CI tokens (e.g. `GH_TOKEN` in `.github-agent.local`) out of application env on Coolify.
