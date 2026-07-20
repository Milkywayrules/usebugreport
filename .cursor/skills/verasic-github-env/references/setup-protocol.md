# verasic-github-env — setup protocol

Single source of truth for GitHub CLI auth in local AI agent harnesses.

## Secrets tiers (do not mix)

| Tier | Delivery | Used for |
| --- | --- | --- |
| Local agents | `.github-agent.local` (+ optional `direnv` via `.envrc`) | `gh` PRs, issues, workflow runs on a dev machine |
| CI | GitHub Actions `GITHUB_TOKEN` or repo Secrets | pipelines |
| Production | Doppler, Vault, Coolify secrets, etc. | running app on VPS/containers |

Never commit tokens. Never put production runtime secrets in agent credential files.

## Credential file

Prefer **`.github-agent.local`** (gitignored) with only:

```bash
GH_TOKEN=github_pat_...
GH_REPO=owner/repo
```

Bootstrap writes `.github-agent.local.example` as a template. `chmod 600` after creating the real file.

**Legacy:** `check-gh.sh` and `load-gh-env.sh` can still read `GH_TOKEN` / `GH_REPO` lines from `.env.local` without executing the file. Prefer migrating GH vars to `.github-agent.local` so app secrets and the PAT stay separate.

## Token type

Use a **fine-grained personal access token** per repo:

1. GitHub → Settings → Developer settings → Fine-grained tokens
2. Resource owner: user or org that owns the repo
3. Repository access: **only this repository**
4. Recommended repository permissions:
   - Metadata — Read (required)
   - Contents — Read and write (branch pushes over HTTPS need Git credential setup; SSH push uses SSH keys)
   - Pull requests — Read and write
   - Issues — Read and write
   - Actions — Read (Read and write only if agent re-runs CI)
   - Workflows — Read (Read and write only if agent edits workflow files)
5. Set expiration and rotate on a calendar reminder

## Bootstrap a repo (once)

After installing verasic-skills into `.cursor/skills/` (via `setup.sh` or copy):

```bash
bash .cursor/skills/verasic-github-env/scripts/bootstrap.sh
```

Or in Cursor: `/verasic-setup-github`

This writes `.envrc`, `.github-agent.local.example`, documents GH vars in `.env.example`, and updates `.gitignore`. If the repo uses a broad `.env*` ignore rule, bootstrap adds `!.env.example` and `!.envrc` negation rules.

**npx skills add:** skills land outside `.cursor/skills/` depending on the host agent. Copy or symlink this skill into `.cursor/skills/verasic-github-env` before running bootstrap, or run bootstrap from the path your agent exposes.

## direnv (optional)

```bash
sudo apt install direnv
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
cd /path/to/repo && direnv allow
```

`.envrc` loads **only** `.github-agent.local` — not the full application `.env.local`.

## Verify

```bash
bash .cursor/skills/verasic-github-env/scripts/check-gh.sh
```

Do not run bare `gh auth status` in agent transcripts — it can print a token prefix. Use `check-gh.sh` instead.

## Agent usage of `gh`

Before any `gh` command, if `GH_TOKEN` is unset:

```bash
source .cursor/skills/verasic-github-env/scripts/load-gh-env.sh
```

Rules:

- use `gh` for GitHub API operations — not browser automation for GitHub
- pass `-R "${GH_REPO}"` when repo auto-detection fails
- `git push` over SSH uses SSH keys; `GH_TOKEN` is for `gh` and GitHub API only
- never log, echo, or commit token values

## Install verasic-skills into a project

```bash
curl -fsSL https://raw.githubusercontent.com/Milkywayrules/verasic-skills/main/setup.sh | bash
```

Skill-only (any agent):

```bash
npx skills add Milkywayrules/verasic-skills
```

Then run bootstrap on each repo that needs GitHub agent access.

## Regression tests

```bash
bash .cursor/skills/verasic-github-env/scripts/test-regression.sh
```
