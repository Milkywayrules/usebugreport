# Deferred work

## Deferred from: code review of 1-2-instant-replay-buffer-and-privacy-plugins (2026-07-20)

- Console/network event arrays have no max-count guard (replay has `MAX_REPLAY_EVENT_COUNT`) — add caps if telemetry storms become a concern in E1-S3
- Response-body 32 KB cap not isolated in unit tests — request path covered; add symmetric test if regressions reported

## Deferred from: code review of 4-3-workspace-and-project-crud-with-ingest-keys (2026-07-20)

- Missing concurrent workspace-create integration test — advisory lock covered in service unit path; add parallel POST test in follow-up
- AC4 Pro-tier sixth workspace not integration-tested — UsageService tier limits covered in E4-S6 unit tests
- `validateIngestKey` scans all active keys (O(n) bcrypt) — optimize with prefix lookup in E2-S2 presign path
- Custom slug input not validated beyond trim — slugify fallback sufficient for v1; add regex validation if bad slugs reported
- `organizationCreation.beforeCreate` tier check lacks advisory lock — mitigated by `allowUserToCreateOrganization: false`; add lock if server-side org create paths expand
- `turbo run test` skips DB integration suites without `DATABASE_URL` — CI harness should export DATABASE_URL for api/services packages
