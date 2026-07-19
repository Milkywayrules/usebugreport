# Infra Checklist

Applies to Dockerfiles, docker-compose files, CI workflows, reverse-proxy configs,
and deploy scripts (Coolify/VPS deployments). Only flag real, reachable impact.

- **Publicly exposed datastores**: compose `ports:` publishing Postgres/MySQL/Redis/etc. to the host on a VPS — internet-reachable databases; internal services belong on the internal network only
- **Secrets committed**: hardcoded passwords/tokens in compose, Dockerfile, or CI files; secrets passed as Docker build args (baked into image layers and inspectable)
- **Container escape surface**: `privileged: true`, `/var/run/docker.sock` mounts, host network mode — any of these on an internet-facing service
- **Data loss on redeploy**: removing/renaming a named volume of a stateful service; DB data on anonymous volumes; entrypoint or migration scripts that drop/recreate tables
- **Proxy exposure**: reverse-proxy labels (Traefik/Caddy) routing an internal service (admin panel, metrics, DB UI) to a public domain without auth
- **Spoofable client identity**: trusting `X-Forwarded-For`/`X-Real-IP` for rate limiting or authz when the app isn't strictly behind the proxy that sets them
- **CI script injection**: untrusted input (PR titles, branch names, issue text) interpolated into `run:` shell commands; secrets echoed to build logs
- **Duplicate side effects across replicas**: cron/schedulers/queue workers that assume a single instance, deployed with multiple replicas — double sends, double charges
- **Boot-order races**: app assumes DB/Redis is ready with no wait/retry where the diff removes or bypasses `depends_on`/healthcheck gating that callers relied on
