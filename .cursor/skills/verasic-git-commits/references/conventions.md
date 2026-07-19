# Verasic commit conventions — canonical spec

The single source of truth for what a Verasic commit message may and may not
contain. Consumed by the write path (`commit-protocol.md`) and the history
audit (`audit-protocol.md`). Never duplicate these tables elsewhere — link here.

Applies to **every commit** (any branch, any agent, any IDE).

## Message style (same casing as comments / JSDoc)

Commit messages are prose, not JSDoc. Where the repo carries
`verasic-jsdoc-and-comments.mdc`, casing aligns with it.

- lowercase first sentence (and after `.`, `?`, `!`, `;`, `:`, `—`)
- natural casing elsewhere: types, acronyms, API routes, component names, field labels (`User ID`, `BRANCH`), ticket ids (`PROJ-1234`)
- body: explain **why**, not a file list — same intent-over-what as inline comments

### Inline code (backticks)

Wrap **technical literals** in backticks so they read as literals, not prose:

| Kind                                 | Examples                           |
| ------------------------------------ | ---------------------------------- |
| CLI **flags / options**              | `--set`, `--commit`, `--dry-run`   |
| CLI **commands** / npm scripts       | `git commit`, `npm run test`       |
| **File paths**                       | `src/foo.ts`, `scripts/release.sh` |
| git **trailers**, env vars, literals | `Co-authored-by:`, `TAG_NAME`      |

Do not backtick whole sentences — only the token. Prefer flags/options
notation: `--set` not `-set` or `set flag`.

### Subject (first line)

- conventional prefix — canonical type list: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, `perf`, `build`, `ci`, `revert`
- optional scope: `(PROJ-1234)` — ticket id natural casing
- after `type:` or `type(scope):` — **lowercase** start for the summary
- imperative mood, concise, no trailing period on the subject

| Good                                         | Bad                                    |
| -------------------------------------------- | -------------------------------------- |
| `chore: add release bump script`             | `Chore: Add release bump script`       |
| `fix(PROJ-1234): undefined variables`        | `fix(PROJ-1234): Undefined variables.` |
| `refactor: streamline shared select styling` | `refactor: Streamline Select Styling`  |

### Body (optional; blank line after subject)

- lowercase first sentence (same punctuation rules as above)
- complete sentences; focus on why the change matters
- no `Co-authored-by:` trailer (see Forbidden trailers below)
- **multiple items:** use a list — one item per line with `- `; do not cram several points into one long wrapped line

**Example (prose body):**

```
chore: add release bump script

automate patch/minor bumps via `--set` so hotfix merges no longer require
hand-editing the deploy version file.
```

**Example (body with multiple items — list, not one line):**

```
fix(PROJ-1234): dedupe mutation error toast

- stop duplicate toast on retry
- keep existing error copy for 4xx
```

not: `- stop duplicate toast on retry, keep existing error copy for 4xx, and align with modal pattern` (one long line)

Use a HEREDOC for multi-line messages so casing stays intentional.

## No AI-session language in messages

Commit messages must **not** read like agent planning, chat output, or
assistant narration — even when no doc files are committed. write as a
teammate explaining **why** the change matters, not as a session log.

### Forbidden patterns (non-exhaustive)

| Kind                                    | Examples to avoid                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **tool / model attribution**            | `Cursor`, `Copilot`, `ChatGPT`, `Claude`, `Gemini`, `GPT`, `LLM`, `OpenAI`, `Anthropic`, `AI-generated`, `AI-assisted`, `written by AI`, `as an AI`, `language model`                                                                                                                                                                    |
| **agent / orchestration workflow**      | `AI agent`, `subagent`, `orchestrator`, `orchestrat`, `multi-agent`, `agent session`, `agent loop`, `auto-mode`, `autopilot`, `composer`, `dispatch`, `spawned agent`, `supervisor loop`, `implementer#`, `qa-verify#`, `doc-writer#`, `qa-tech#`                                                                                        |
| **session / handoff artifacts**         | `handoff`, `handoff contract`, `handoff doc`, `session output`, `chat session`, `conversation`, `from the chat`, `cross-session`, `carry-over from`                                                                                                                                                                                      |
| **plan / milestone vocabulary**         | `milestone brief`, `sprint task`, `action item`, `implementation plan`, `execution plan`, `per plan`, `per RUNBOOK`, `checkpoint L1`, `checkpoint L2`, `L2b`, `follow-up task`, `next steps from`                                                                                                                                        |
| **numbered plan steps**                 | `Task 14`, `task 8`, `Step 3:`, `step 3 of`, `item 4 —`, `TODO 12`, `slice N`, `batch N` (when naming a plan step, not a PR batch label)                                                                                                                                                                                                 |
| **screen-spec / design-plan shorthand** | `SS1`, `SS4+5`, `xd ss3`, `per SS6`, `screenshot 4`, `wireframe ref`, `verbatim XD`, `Figma frame 12` (when citing plan IDs, not neutral design work)                                                                                                                                                                                    |
| **chat meta / request narration**       | `user asked`, `user requested`, `as requested`, `per user`, `as discussed`, `based on conversation`, `following instructions`, `per prompt`, `from the query`, `addresses feedback from chat`                                                                                                                                            |
| **assistant register / AI voice**       | first-person assistant (`I added`, `I've updated`, `I will`, `let me`, `here is`, `this commit`), filler openers (`Additionally,`, `Furthermore,`, `It's worth noting`, `In order to`, `This ensures that`), hype adjectives (`robust`, `comprehensive`, `seamless`, `leverage`, `delve into`, `utilize` when stacked or clearly filler) |
| **commit meta-narration**               | body that reads like a change ledger — long file lists, `files changed:`, `updated the following`, `changes include:` followed by paths, `modified: src/...` dumps without **why**                                                                                                                                                       |
| **emoji subjects**                      | decorative emoji in subject (`✨`, `🚀`, `🤖`, `🔧`) — use plain conventional subjects                                                                                                                                                                                                                                                   |
| **session trailers / meta lines**       | any `Co-authored-by:` (see below), `Signed-off-by: AI`, `Reviewed-by: Copilot`, `Generated-with:`, `Generated with [Claude Code]`, `🤖 Generated with`                                                                                                                                                                                   |

### Allowed (common false positives)

| OK                     | Why                                                                     |
| ---------------------- | ----------------------------------------------------------------------- |
| ticket ids             | `ACB-5341`, `PROJ-1234` — product tracking, not session ids             |
| component / API names  | `TabOverview`, `notes API contract`, `UserAgent` header                 |
| neutral design wording | `align labels with design spec`, `match Figma spacing on overview tab`  |
| domain "agent"         | insurance agent, sales agent — not workflow attribution                 |
| imperative dev prose   | `add`, `fix`, `refactor`, `remove` — normal commit voice                |

## Forbidden trailers and meta lines

- no `Co-authored-by:` trailer in **any casing** — `Co-Authored-By: Claude <noreply@anthropic.com>` (Claude Code's exact form) counts the same as `Co-authored-by: Cursor <cursoragent@cursor.com>`; always match case-insensitively on the line start
- no generation-attribution lines: `Generated-with:`, `Generated with [Claude Code](...)`, `🤖 Generated with ...`
- no `Signed-off-by: AI`, `Reviewed-by: Copilot`, or similar session meta trailers

Detection and removal recipes live in `commit-protocol.md` (write path) and
`audit-protocol.md` (history scan).
