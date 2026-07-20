---
name: verasic-github-env
description: GitHub CLI auth for local AI agent harnesses — fine-grained PAT in gitignored .github-agent.local, direnv, gh verify. Use when setting up gh for agents, creating GH_TOKEN, wiring GitHub PR/issue/CI workflows per repo, or before any gh command when auth may be missing.
---

# Verasic GitHub Env — Local Agent Harness Auth

## Workflows

**Bootstrap path — wire a repo once:**

1. Read `references/setup-protocol.md` for secrets tiers and PAT permissions.
2. Run `scripts/bootstrap.sh` from the repository root (or invoke `/verasic-setup-github` in Cursor).
3. User creates `.github-agent.local` with `GH_TOKEN` (never commit).
4. Run `scripts/check-gh.sh` to verify.

**Runtime path — before any `gh` command:**

1. If `GH_TOKEN` is unset, load credentials without executing env files:

```bash
source .cursor/skills/verasic-github-env/scripts/load-gh-env.sh
```

2. Use `gh` with `-R "${GH_REPO}"` when auto-detection fails.
3. Never log or commit tokens. Do not run bare `gh auth status` in agent logs — use `check-gh.sh`.

## Source of truth

The full spec lives in `references/setup-protocol.md`. The Cursor rule is a thin digest; never duplicate the spec elsewhere.

## Hard rules

- Local agents → `.github-agent.local`; CI → GitHub Actions; production → secrets manager — never mix tiers.
- One fine-grained PAT per repo, scoped to that repo only.
- Never use `gh auth login` device-flow polling loops for harness setup — use `GH_TOKEN`.
