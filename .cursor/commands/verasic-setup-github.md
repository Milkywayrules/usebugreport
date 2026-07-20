Wire GitHub CLI auth for the local AI agent harness on this repo.

Read `.cursor/skills/verasic-github-env/references/setup-protocol.md`, then run from the repository root:

```bash
bash .cursor/skills/verasic-github-env/scripts/bootstrap.sh
```

After bootstrap, tell me clearly:

1. Create a fine-grained PAT scoped to this repo (link: https://github.com/settings/tokens?type=beta) — recommended permissions are in the setup protocol.
2. Copy `.github-agent.local.example` → `.github-agent.local`, set `GH_TOKEN`, run `chmod 600 .github-agent.local` (never commit).
3. Run `direnv allow` if I use direnv.
4. Verify with `bash .cursor/skills/verasic-github-env/scripts/check-gh.sh`.

Do not run `gh auth login` device-flow loops. Do not print or commit token values. Do not run bare `gh auth status` in chat — use `check-gh.sh`.
