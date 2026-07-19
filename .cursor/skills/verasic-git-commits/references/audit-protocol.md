# Verasic commit audit protocol — read path

Audit **the user's** commits on the **current branch** before push or PR.
Checks Verasic message style, forbidden trailers, AI-session language, and
doc/AI artifact files — **audit only by default**. The message spec lives in
`conventions.md` next to this file; read it first.

## Usage

| Invoke                                    | Output                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/verasic-audit-commits --help`           | Help only — no git audit                                                                                |
| `/verasic-audit-commits`                  | Full audit report (default scope below)                                                                 |
| `/verasic-audit-commits --unpushed-only`  | Limit range to `@{upstream}..HEAD` (fail clearly if no upstream)                                        |
| `/verasic-audit-commits --base develop`   | Use merge-base with `origin/develop` instead of the detected default branch                             |
| `/verasic-audit-commits --author "Name"`  | Override author filter (default: `git config user.name`)                                                |
| `/verasic-audit-commits --include-merges` | Include merge commits in message scan (still skip for file scan unless noted)                           |
| `/verasic-audit-commits --fix-trailers`   | **Rewrite history** to strip co-authored trailers — only when user explicitly approves after audit      |

Flags compose: `/verasic-audit-commits --unpushed-only --base master`

**Default scope** (when user does not override):

- current branch checkout
- base: detected default branch (see Resolve scope), or user `--base`
- range: `merge-base(origin/<base>..HEAD)..HEAD`
- **`--no-merges`** (exclude merged-in commits from other branches)
- author: **`git config user.name`** only
- full Verasic style + AI-language + committed-file checks
- **do not rewrite** unless `--fix-trailers` and explicit user approval

---

## Help mode (`--help`)

1. Do not run the audit.
2. Reply with this protocol's usage table + default scope + what each check category means.
3. End with: "Run without `--help` when ready to audit."

---

## Audit workflow

1. **Read** `conventions.md` — especially the forbidden-patterns table, the allowlist, and the trailer policy.

2. **Resolve scope** at repo root:

```bash
BRANCH=$(git branch --show-current)
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD --short 2>/dev/null | sed 's|^origin/||')
BASE_REF=origin/${DEFAULT_BRANCH:-master}   # user --base wins; if origin/master is missing, try origin/main
AUTHOR="$(git config user.name)"

git merge-base HEAD "$BASE_REF"
git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null || echo 'no upstream'
```

- If `--unpushed-only`: range = `@{upstream}..HEAD`; stop with clear message if no upstream.
- Else: range = `$(git merge-base HEAD "$BASE_REF")..HEAD`.
- If user says branch was never pushed, treat whole branch range as unpushed — do not assume `@{upstream}`.

3. **List commits** in scope:

```bash
git log --no-merges --author="$AUTHOR" --format='%H %s' <range>
```

Report the commit count from this author-filtered list. Note commits from
other authors (merge or not) separately as out of scope — never mix them into
the scanned count (merges stay out unless `--include-merges`).

4. **Run checks** on each commit message in scope.

### A. Verasic style (spec: `conventions.md` § Message style)

| Check               | Fail when                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Conventional prefix | subject type is not on the canonical type list in `conventions.md`                               |
| Subject casing      | uppercase first word after `type:` or `type(scope):`                                             |
| Subject period      | subject ends with `.`                                                                            |
| Blank line          | body present but no blank line after subject                                                     |
| Body casing         | first prose sentence or list item starts uppercase without allowed proper noun/acronym/component |

### B. Forbidden trailers and meta lines

```bash
git log -1 --format=%B <hash> | grep -qiE '^co-authored-by:' && echo FAIL
```

Any line-anchored `Co-authored-by:` in **any casing** fails (not bare
`co-authored-by` mid-prose). Also fail on generation/meta lines anywhere in
the body: `Generated-with:`, `Generated with [`, `🤖 Generated`,
`Signed-off-by: AI`, `Reviewed-by: Copilot`.

### C. AI-session / planning / agent-voice language

Scan the **full message** (subject + body) against the forbidden-patterns
table in `conventions.md` § No AI-session language, and clear hits against its
allowlist before flagging. Match case-insensitively unless the pattern is
case-sensitive (run ids, ticket ids).

**Quick grep helper** (per commit; expect false positives — apply allowlist):

```bash
git log -1 --format=%B <hash> | grep -iE \
  'cursor|copilot|chatgpt|claude|gemini|\bGPT\b|\bLLM\b|openai|anthropic|ai[- ]generated|ai[- ]assisted|as an ai|language model|\
subagent|orchestrat|multi-agent|agent session|agent loop|auto-mode|autopilot|\
implementer#|qa-verify#|doc-writer#|qa-tech#|\
handoff|session output|chat session|from the chat|cross-session|\
milestone brief|sprint task|action item|implementation plan|execution plan|per plan|per runbook|checkpoint l[12]|follow-up task|\
task [0-9]+|step [0-9]+:|step [0-9]+ of|todo [0-9]+|\
\bSS[0-9]|xd ss|per SS|verbatim XD|wireframe ref|\
user asked|user requested|as requested|per user|as discussed|based on conversation|following instructions|per prompt|from the query|\
\bI added\b|\bI will\b|\bI'"'"'ve updated\b|let me |here is |this commit|\
additionally,|furthermore,|it'"'"'s worth noting|in order to|this ensures that|\
files changed:|updated the following|changes include:|\
generated[- ]with|🤖 generated|signed-off-by: ai|reviewed-by: copilot' \
  && echo 'REVIEW: possible AI-session language'
```

Prefer **why** in the body; flagged messages should be rewritten to neutral
teammate voice before push.

### D. Committed files (artifact leak)

Files touched by commits in scope must not include:

- `*.md`, `*.mdc`, `*.txt`, `*.canvas`, `*.jsonl` under agent paths
- `.cursor/`, `.agents/`, `.superpowers/`, `.claude/`, `.tmp*`, `.local/`
- `docs/**` unless user explicitly scoped docs work

Exception: repos whose **purpose** is those files (a skills/rules/docs repo)
— note the exception in the report instead of flagging every commit.

```bash
git log --no-merges --author="$AUTHOR" --name-only --pretty=format: <range> \
  | sort -u | grep -v '^$'
```

Filter paths against artifact patterns; report any hit with commit(s) that
introduced them.

5. **Produce report** — grouped by severity:

| Tier            | Meaning                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Blocker**     | co-authored trailer (any casing), generation/meta lines, doc/AI files committed               |
| **Style**       | Verasic casing / structure violations                                                          |
| **AI language** | session, planning, orchestration, or assistant-voice references (rewrite message before push)  |

For each violation: `short-hash`, subject, category, matched phrase or path.
List artifact-file hits only in the "Committed artifact files" section but
count them in the **Blocker** tally — do not double-list them.

End with tallies: `clean: N`, `violations: N` per tier, and **PASS / FAIL** overall.

6. **Fix mode (`--fix-trailers`)** — only if user explicitly approved after seeing audit:

- confirm branch **not pushed** (or user approved force-push)
- stash dirty working tree if needed
- replay `<range>` with `git commit-tree` msg-filter stripping any line matching `^co-authored-by:` case-insensitively; preserve trees, authors, dates, merge parents (`mapping.get(p,p)` for out-of-range parents)
- re-run this audit; report tree unchanged vs pre-fix tip if applicable
- **never** use `git commit` / `git commit --amend` for bulk trailer removal in an agent-managed terminal (the wrapper re-injects)

For AI-language or Verasic casing fixes: report suggested rewordings; rewrite
only when user approves (same `commit-tree` replay or interactive rebase in an
external terminal).

---

## Output format

```markdown
## Verasic commit audit

- branch: …
- range: …
- author: …
- commits scanned: N

### Blockers

…

### Verasic style

…

### AI-session / agent-voice language

…

### Committed artifact files

…

**Result:** PASS | FAIL
```

Your final reply must be the report itself in exactly this format — never a
prose summary. Do **not** push, rewrite, or commit unless the user explicitly
asks after the audit.

---

## When to run

- end of week / before first push of a feature branch
- after agent-assisted commit batches
- after history rewrite or rebase
- before opening a PR

## Related

- Spec: `conventions.md` (same folder)
- Write path + trailer escape hatch: `commit-protocol.md` (same folder)
