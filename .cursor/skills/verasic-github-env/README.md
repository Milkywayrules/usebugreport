# Verasic GitHub Env

Reproducible GitHub CLI auth for local AI agent harnesses across Verasic
projects. Fine-grained PAT per repo in gitignored `.github-agent.local`,
optional `direnv`, bootstrap + verify scripts — separate from CI and
production secrets.

## Parts

| File | Role |
| --- | --- |
| `.cursor/skills/verasic-github-env/references/setup-protocol.md` | Spec — tiers, PAT permissions, bootstrap, agent usage |
| `.cursor/skills/verasic-github-env/scripts/bootstrap.sh` | Wire repo once — `.envrc`, templates, `.gitignore` |
| `.cursor/skills/verasic-github-env/scripts/load-gh-env.sh` | Safe GH var loader (no shell execution of env files) |
| `.cursor/skills/verasic-github-env/scripts/check-gh.sh` | Verify `GH_TOKEN` + `gh auth status` |
| `.cursor/skills/verasic-github-env/scripts/test-regression.sh` | Disposable regression tests |
| `.cursor/skills/verasic-github-env/SKILL.md` | Auto-trigger + orchestration |
| `.cursor/rules/verasic-github-env.mdc` | Always-applied digest for `gh` commands |

## Install into a project

```bash
curl -fsSL https://raw.githubusercontent.com/Milkywayrules/verasic-skills/main/setup.sh | bash
```

Skill-only (any agent):

```bash
npx skills add Milkywayrules/verasic-skills
```

If the skill is not under `.cursor/skills/`, copy or symlink it there before bootstrap (see setup-protocol.md).

## Wire one repo

```bash
bash .cursor/skills/verasic-github-env/scripts/bootstrap.sh
```

Or in Cursor: `/verasic-setup-github`

Then:

1. Create a fine-grained PAT scoped to this repo only (see setup-protocol.md).
2. `cp .github-agent.local.example .github-agent.local` — set `GH_TOKEN`, `chmod 600`.
3. `direnv allow` (optional).
4. `bash .cursor/skills/verasic-github-env/scripts/check-gh.sh`

Legacy: `load-gh-env.sh` still reads `GH_*` lines from `.env.local` if present.

## Secrets tiers

| Tier | Where |
| --- | --- |
| Local agents | `.github-agent.local` + `.envrc` |
| CI | GitHub Actions secrets |
| Production | Doppler / Coolify / vault |

## Usage

- Agents run `load-gh-env.sh` before `gh` when `GH_TOKEN` is unset — rule applies automatically.
- `/verasic-setup-github` — bootstrap current repo
- Regression: `bash .cursor/skills/verasic-github-env/scripts/test-regression.sh`

## Extend per repo

After bootstrap, add a one-liner to the project README deploy section pointing
at the secrets tier table in `setup-protocol.md`. Do not fork token handling
per repo — only `GH_REPO` and the PAT scope change.
