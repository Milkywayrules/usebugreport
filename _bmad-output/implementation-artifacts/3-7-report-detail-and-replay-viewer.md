---
baseline_commit: 56a0cd2
depends_on:
  - 2-5-reportservice-metadata-reads-and-replay-manifest
  - 3-1-web-app-shell-theme-and-route-scaffold
---

# Story 3.7: Report detail and replay viewer

Status: review

## Story

As a project member,
I want replay, console, network, and metadata tabs on report detail,
so that I can diagnose bugs in one surface.

## Acceptance Criteria

1. Replay tab loads manifest via TanStack Query and rrweb-player from presigned URLs.
2. Console/network tabs support level/status/host filters with redacted bodies.
3. Forbidden responses render full-page alert.
4. Expired replay shows tier retention copy.

## Tasks / Subtasks

- [x] Report read API routes (`/api/v1/reports/:id` + manifest/console/network)
- [x] Report detail route with tabs and ReplayViewer
- [x] Filter unit tests
