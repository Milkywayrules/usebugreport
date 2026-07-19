# Verasic commit protocol — write path

How to produce a compliant commit. The message spec (style, forbidden
patterns, trailer policy) lives in `conventions.md` next to this file — read
it before composing your first commit message of a session.

## Deterministic layer — commit-msg hook (recommended)

`hooks/commit-msg` (in this skill) enforces the mechanical subset on every
commit with zero LLM involvement: it auto-strips co-authored/generated
attribution lines in any casing **before the commit object is written**
(verified against the Cursor Agent wrapper — the injected trailer never lands),
and rejects bad type prefixes, uppercase summary starts, trailing periods,
emoji subjects, and missing blank lines. AI-language smells only warn — that
judgment stays with the pre-push audit.

Wire it once per repo, either way:

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

With the hook wired, the verify step below should always print `clean` and the
escape hatch becomes unnecessary — keep running verify anyway as the cheap
proof, and fall back to the escape hatch only in unwired repos.

Two limits to know:

- hooks are client-side and skippable — never pass `--no-verify` / `-n` to `git commit`; if the hook rejects the message, fix the message. The pre-push audit stays the backstop for commits made in unwired clones.
- the emoji-subject check needs GNU grep (`-P`); on macOS/BSD grep it silently skips — every other check works everywhere.

## Commit workflow

1. Stage changes; draft the message against `conventions.md` (no trailer, no AI-session language).
2. Optional pre-check on the draft:

```bash
printf '%s' "$MSG" | grep -qiE '^co-authored-by:' && echo 'draft has trailer'
```

3. `git commit` (HEREDOC message so casing stays intentional).
4. **Verify** (line-anchored, case-insensitive — do not grep bare `co-authored-by`; subject text can false-positive):

```bash
git log -1 --format=%B | grep -qiE '^co-authored-by:' && echo 'TRAILER PRESENT' || echo 'clean'
```

5. If **clean** → done.
6. If **TRAILER PRESENT** and commit is **not** pushed → use the [escape hatch](#agent-trailer-escape-hatch-fallback-only); **do not** loop on amend.
7. If already pushed → do not force-push; tell the supervisor and fix on a follow-up commit or with their approval.

## Why trailers appear (agent harness injection)

**Typical cause (Cursor Agent):** the Agent terminal wraps `git commit` and
`git commit --amend` and appends `Co-authored-by: Cursor <cursoragent@cursor.com>` —
including with `-m` HEREDOC and `-F` message file. **`git commit --amend` does
not remove it**; it injects again. Other harnesses inject their own casing
(Claude Code: `Co-Authored-By: Claude <noreply@anthropic.com>`, plus a
`🤖 Generated with [Claude Code](...)` body line) — the verify step above
catches the trailer in any casing; scan for the `Generated with` line too when
working outside Cursor.

**If behavior differs in your repo:** check active hooks (not `.sample` files):

```bash
test -x .git/hooks/prepare-commit-msg && echo 'has prepare-commit-msg'
test -x .git/hooks/commit-msg && echo 'has commit-msg'
```

If hooks exist, fix or document them separately. The escape hatch below
bypasses the normal commit wrapper (and may skip hook behavior).

## Agent trailer escape hatch (fallback only)

**Typical Cursor Agent terminal** (re-verify in your environment):

| Command                                          | trailer injected?                      |
| ------------------------------------------------ | -------------------------------------- |
| `git commit` (`-m` HEREDOC)                      | yes                                    |
| `git commit -F` message file                     | yes                                    |
| `git commit --amend` (`--allow-empty` if needed) | yes — amend does **not** strip trailer |
| `git commit-tree` + `git reset --hard`           | no                                     |

`git commit-tree` is plumbing — it writes the commit from the index tree +
message without the agent's commit wrapper.

**When to use**

- verify matches a trailer after a normal commit (amend will not fix it)
- the commit is **not** pushed

**When not to use**

- as the default commit path every time
- after the commit is already on the remote (no force-push without supervisor approval)
- when you must run `commit-msg` / GPG signing hooks that only fire on `git commit` (escape hatch skips the usual commit wrapper)

**Recipe** (stage first; `$MSG` = intended message, no trailer):

```bash
MSG="$(cat <<'EOF'
type(scope): lowercase summary

lowercase body — why this change matters.
EOF
)"
TREE=$(git write-tree)
PARENT=$(git rev-parse HEAD)
COMMIT=$(printf '%s' "$MSG" | git commit-tree "$TREE" -p "$PARENT")
git reset --hard "$COMMIT"
git log -1 --format=%B | grep -qiE '^co-authored-by:' && echo 'TRAILER STILL PRESENT' || echo 'clean'
```

- **First commit on a branch** (no parent): omit `-p "$PARENT"`.
- **Empty index:** `git write-tree` fails — stage changes first (or use `--allow-empty` via a normal commit only if you accept fixing the trailer afterward).

**Note:** injection is commonly seen in agent-managed shells; an external
terminal may differ — still run the verify step after every commit.

## Pre-push audit

Run `/verasic-audit-commits` (or follow `audit-protocol.md` directly) before
the first push of a feature branch, after agent-assisted commit batches, and
before opening a PR. Audit-only by default — it never rewrites history without
explicit approval.

## Repo-specific overlays

Initiative or team docs (e.g. a platform-upgrade RUNBOOK) may add constraints
**on top of** this protocol. Keep those in the initiative doc; do not fork
casing or trailer rules per repo unless the team explicitly changes Verasic
defaults.
