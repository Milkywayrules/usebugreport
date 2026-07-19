# Verasic Bugbot

Bugbot-like code review that runs locally in Cursor — no Bugbot subscription needed.
Reviews git diffs for real bugs (logic, security, races, perf) with an aggressive
low-noise filter. Style nitpicks are never reported.

## Parts

| File                                             | Role                                            |
| ------------------------------------------------ | ----------------------------------------------- |
| `.cursor/skills/verasic-bugbot/references/`      | `review-protocol.md` — the brain, single source |
| `.cursor/skills/verasic-bugbot/checklists/`      | Modular bug-hunting checklists                  |
| `.cursor/skills/verasic-bugbot/SKILL.md`         | Auto-trigger + orchestration                    |
| `.cursor/agents/verasic-bugbot.md`               | Cursor subagent — thin pointer to the protocol  |
| `.cursor/commands/verasic-review.md`             | `/verasic-review` slash command                 |

## Human workflow (which slash entry do I use?)

Typing `/verasic` in Cursor chat shows three entries — they are different types
sharing one system:

- **`/verasic-review`** (command) — the one you normally use. Kicks off a review
  of your branch changes. Add "uncommitted" to review staged + unstaged only.
- **`/verasic-bugbot`** (skill) — attaches the orchestration instructions to your
  message and runs in your current conversation. Useful when phrasing a custom
  request, e.g. "/verasic-bugbot review only the API layer".
- **`/verasic-bugbot`** (agent) — talks to the review subagent directly. It runs
  in its own isolated context, so the (long) review work doesn't clutter your
  chat — only the report comes back. Rarely needed; the command and skill both
  launch it for you.

Naming rationale: the agent and skill share the name `verasic-bugbot` because
they are the same brain; the command is a verb (`verasic-review`) because it is
the action a human runs — and it keeps the slash menu unambiguous.

Day-to-day loop:

1. Finish a feature/fix.
2. Run `/verasic-review` (or just say "bugbot review my changes").
3. Fix CRITICAL/HIGH findings, re-run until `✅ No issues found`.
4. Commit / open PR.

## Output

One-line verdict (`✅` / `🐛`), then issues ranked CRITICAL / HIGH / MEDIUM,
each with file:line, evidence from the code, and a concrete fix.

## Extend per project

Drop extra `.md` checklists into `checklists/` (e.g. `laravel.md`, `flutter.md`) —
the protocol applies every file in that folder automatically, and the reviewer
will tip you when your repo's stack has no matching checklist yet.

Custom checklists are safe across updates: `setup.sh` merges folders and only
overwrites the core files, so your additions survive. Commit them with the
project; if one proves useful across projects, promote it upstream to the
`verasic-skills` repo so every install gets it.

## Install into a new project

From the project root:

```bash
curl -fsSL https://raw.githubusercontent.com/Milkywayrules/verasic-skills/main/setup.sh | bash
```

or skill-only (any agent, not just Cursor): `npx skills add Milkywayrules/verasic-skills`
