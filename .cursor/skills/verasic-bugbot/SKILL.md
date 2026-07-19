---
name: verasic-bugbot
description: Bugbot-like local code review. Use when the user asks to "review changes", "bugbot review", "check my diff", "find bugs in my changes", or after completing a significant code change and wanting verification before commit/PR.
---

# Verasic Bugbot — Local Review Orchestration

## Workflow

1. Determine scope from the user's message: branch changes (default) or uncommitted changes.
2. In Cursor: launch the `verasic-bugbot` subagent (`.cursor/agents/verasic-bugbot.md`) with the repository path and scope, in the foreground, then relay its report unchanged.
3. In any agent without subagents: read `references/review-protocol.md` and execute the review yourself in this conversation, following it exactly.

## Source of truth

The full review protocol (diff scope, process, filtering, output format) lives in `references/review-protocol.md`. The Cursor subagent is a thin pointer to it; never duplicate the protocol elsewhere.

## Checklists (used by the protocol)

Modular checklists live in `checklists/`:

- `checklists/correctness.md` — logic, edge cases, contracts, concurrency
- `checklists/security.md` — injection, secrets, authz, unsafe deserialization
- `checklists/performance.md` — N+1, unbounded growth, blocking calls
- `checklists/infra.md` — Docker/compose/CI/proxy: exposed ports, secrets, data loss

Add project-specific checklists as new files here; the protocol applies every `.md` file in `checklists/`.

## Hard rules

- Never review without reading full files — hunks lie.
- Never report style/nitpicks. Real bugs only.
- Zero findings is a valid result; report it confidently.
