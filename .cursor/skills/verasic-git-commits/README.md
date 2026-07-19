# Verasic Git Commits

Hard commit convention for AI-assisted workflows. Every commit — human or
agent — follows one message style, carries no co-authored/AI trailers, and
reads like a teammate explaining why, never like a session log. A pre-push
audit scans branch history for violations before they reach a PR.

Battle-tested daily on Verasic and Autopedia repos for months before being
packaged here.

## Parts

| File                                             | Role                                               |
| ------------------------------------------------ | -------------------------------------------------- |
| `.cursor/skills/verasic-git-commits/references/` | The spec + both protocols — single source of truth |
| `.cursor/skills/verasic-git-commits/hooks/`      | `commit-msg` git hook — deterministic layer        |
| `.cursor/skills/verasic-git-commits/SKILL.md`    | Auto-trigger + orchestration                       |
| `.cursor/rules/verasic-git-commits.mdc`          | Always-applied digest — enforcement at commit time |
| `.cursor/commands/verasic-audit-commits.md`      | `/verasic-audit-commits` slash command             |
| `.cursor/agents/verasic-commit-auditor.md`       | Audit subagent — isolated context, read-only       |

## Three enforcement layers

| Layer             | What                                | Catches                                                                                          | Cost                     |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| 0 — deterministic | `hooks/commit-msg` git hook         | trailer/attribution strip (any casing, pre-write), bad prefix, casing, period, emoji, blank line | zero tokens, can't drift |
| 1 — write time    | always-applied rule digest          | message _quality_: why-not-what body, backticks, AI voice avoidance                              | ~35 lines per context    |
| 2 — judgment      | `/verasic-audit-commits` (subagent) | AI-session language in history, artifact files, anything regex can't judge                       | one run before push/PR   |

Wire the hook per repo (once):

```yaml
# lefthook.yml (repos already on lefthook)
commit-msg:
  commands:
    verasic:
      run: bash .cursor/skills/verasic-git-commits/hooks/commit-msg {1}
```

```bash
# raw git (repo without a hook manager)
git config core.hooksPath .cursor/skills/verasic-git-commits/hooks
```

With the hook wired, injected trailers (Cursor, Claude Code, …) are stripped
before the commit object exists — the `commit-tree` escape hatch is only
needed in unwired repos.

Caveats: hooks are client-side (`--no-verify` skips them — forbidden by the
rule; the audit stays the backstop), and the emoji check needs GNU grep, so
macOS/BSD grep silently skips that one check.

## How the pieces relate

- The **rule** is always in context (Cursor `alwaysApply`), so every commit an
  agent makes follows the digest without being asked. It points into
  `references/` for the full spec and recipes.
- The **command** is the human trigger for the pre-push audit. It launches the
  subagent so dozens of commit messages don't flood your chat — only the
  report comes back.
- The **skill** makes both workflows portable: agents without Cursor rules or
  subagents (Claude Code, Codex, …) read the same `references/` files and run
  the same workflows inline.

Non-Cursor always-on enforcement: add one row to the repo's `AGENTS.md` (or
`CLAUDE.md`):

```markdown
| Git commits (style + no trailer) | [.cursor/skills/verasic-git-commits/references/commit-protocol.md](.cursor/skills/verasic-git-commits/references/commit-protocol.md) |
```

## Usage

- Committing: nothing to invoke — the rule applies automatically; agents verify the trailer after every commit.
- `/verasic-audit-commits` — audit your branch commits vs the default branch
- `/verasic-audit-commits --unpushed-only` — only commits not yet pushed
- `/verasic-audit-commits --base develop` — different base branch
- `/verasic-audit-commits --help` — usage table, no audit
- Or just say "audit my commits before I push"

## Output

Audit report with scope header, violations grouped Blocker / Style /
AI language (each with short-hash, subject, matched phrase), tallies, and an
overall **PASS / FAIL**.

## Day-to-day loop

1. Work as usual; commits follow the convention automatically (verify step catches injected trailers).
2. Before first push or PR: `/verasic-audit-commits`.
3. Fix Blockers (trailer strip via the `commit-tree` escape hatch — only with your approval), reword flagged messages, re-run until **PASS**.
4. Push / open PR.

## Extend per repo

Initiative docs may add constraints on top (e.g. a RUNBOOK requiring ticket
scopes on every subject). Keep overlays in the initiative doc — never fork the
casing or trailer rules per repo unless the team changes Verasic defaults.

## Install into a new project

From the project root:

```bash
curl -fsSL https://raw.githubusercontent.com/Milkywayrules/verasic-skills/main/setup.sh | bash
```

or skill-only (any agent, not just Cursor): `npx skills add Milkywayrules/verasic-skills`
