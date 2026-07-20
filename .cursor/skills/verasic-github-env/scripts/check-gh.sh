#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$(dirname "${BASH_SOURCE[0]}")/load-gh-env.sh"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "check-gh: GH_TOKEN is unset — add a fine-grained PAT to .github-agent.local (preferred) or .env.local" >&2
  echo "check-gh: see .cursor/skills/verasic-github-env/references/setup-protocol.md" >&2
  exit 1
fi

if [[ -z "${GH_REPO:-}" ]]; then
  if origin_url="$(git remote get-url origin 2>/dev/null)"; then
    # shellcheck disable=SC1091
    source "$(dirname "${BASH_SOURCE[0]}")/parse-gh-repo.sh"
    GH_REPO="$(verasic_parse_gh_repo_from_remote "$origin_url" || true)"
    [[ -n "${GH_REPO:-}" ]] && export GH_REPO
  fi
fi

if [[ -z "${GH_REPO:-}" ]]; then
  echo "check-gh: GH_REPO is unset — add GH_REPO=owner/repo to .github-agent.local or fix origin remote" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "check-gh: gh CLI not found — install from https://cli.github.com" >&2
  exit 1
fi

gh auth status >/dev/null 2>&1
gh repo view "$GH_REPO" --json nameWithOwner -q .nameWithOwner >/dev/null

echo "check-gh: ok — authenticated for $GH_REPO"
