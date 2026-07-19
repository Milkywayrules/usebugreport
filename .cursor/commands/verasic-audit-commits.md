Audit my commits on the current branch against the Verasic commit convention (pre-push).

If I passed `--help`: do not audit — print the usage table and default scope from `.cursor/skills/verasic-git-commits/references/audit-protocol.md`, then stop.

Otherwise, launch the `verasic-commit-auditor` subagent with this prompt:

"Full Repository Path: <current workspace root>
Flags: <any flags I passed, e.g. --unpushed-only, --base develop, --author "Name", --include-merges; default scope otherwise>
Follow your system prompt fully: read the audit protocol, resolve scope, run every check, and report in the standard output format."

After the subagent returns, relay its report verbatim — do not soften tiers or drop violations. If everything passed, say so plainly.

The audit is read-only. Fix mode (`--fix-trailers` history rewrite) runs in this conversation, not the subagent, and only after I explicitly approve the audit report — follow the fix-mode section of the audit protocol exactly.
