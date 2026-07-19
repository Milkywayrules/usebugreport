Run a Bugbot-like review of my local changes.

Launch the `verasic-bugbot` subagent with this prompt:

"Full Repository Path: <current workspace root>
Diff: branch changes (use 'uncommitted changes' if I said so in my message)
Follow your system prompt fully: read full files, trace callers, apply the checklists in .cursor/skills/verasic-bugbot/checklists/, filter aggressively, and report in your standard output format."

After the subagent returns, relay its findings verbatim — do not soften severities or drop issues. If it found zero issues, say so plainly.
