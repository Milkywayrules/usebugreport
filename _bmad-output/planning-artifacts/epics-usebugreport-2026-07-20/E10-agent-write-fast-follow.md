# Epic E10: Agent Write — `create_comment` (Fast-follow FF-1)

**Scope:** Post v1.0 launch — **≤ 2 weeks**; blocks v1.1 if missed. **Not an LG gate.** Human web comments ship in E3-S8 (FR-26).

**FRs:** FR-16 | **ADs:** AD-1, AD-2

---

## Story E10-S1: REST and MCP create_comment via CommentService

As an AI agent with Pro API key,
I want to create report comments via MCP and REST,
So that agent notes appear in the same thread as human comments (FR-16).

**Acceptance Criteria:**

**Given** surface registry entry `comments.create` enabled (`launchGate: true` in FF build)
**When** `POST /api/v1/reports/:id/comments` called with Bearer key scoped `reports:write`
**Then** `CommentService.create` invoked — same method as `POST /api/web/reports/:id/comments` (AD-1, FR-16)

**Given** MCP tool `create_comment`
**When** invoked with equivalent params
**Then** field-equivalent comment payload returned modulo transport envelope (FR-16)

**Given** Free tier key
**When** create attempted
**Then** HTTP/MCP 403 `FORBIDDEN` via `UsageService.checkTierLimit` (AD-11)

**Given** optional client dedupe key header/param
**When** duplicate submit
**Then** idempotent — same comment returned (FR-16)

**Technical notes:** Registry paths in architecture §5.2. Parity tests extend `parity.test.ts` for write operation. Table `report_comments`.

**Dependencies:** E3-S8 (CommentService), E6-S2, E5-S1. **Blocked from v1.0 launch scope.**

---

## Story E10-S2: Web thread attribution for agent comments

As a triage user,
I want agent-created comments labeled with API key name,
So that the Comments tab distinguishes human vs agent authors (FR-16, EXPERIENCE.md).

**Acceptance Criteria:**

**Given** comment created via API key
**When** web Comments tab renders
**Then** author display shows API key name from `workspace_api_keys` — not user display name (FR-16)

**Given** human comment from E3-S8
**When** same thread
**Then** chronological order preserved; both types coexist (EXPERIENCE.md assumption)

**Given** FF-4 prerequisite
**When** comment created via API
**Then** `webhooks.dispatch` for `report.comment.created` **not required in this story** — ships E11-S3

**Technical notes:** No change to session web route auth model. Playwright optional for agent attribution mock.

**Dependencies:** E10-S1.
