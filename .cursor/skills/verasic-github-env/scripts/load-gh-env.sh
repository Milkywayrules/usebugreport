#!/usr/bin/env bash
# shellcheck shell=bash
# Extract GH_TOKEN / GH_REPO without executing env files. Source from repo root:
#   source .cursor/skills/verasic-github-env/scripts/load-gh-env.sh

set -euo pipefail

_verasic_extract_var() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1

  local line value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == "${key}="* ]] || continue
    value="${line#*=}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "$value" =~ ^\"(.*)\"$ ]]; then
      value="${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    printf '%s' "$value"
    return 0
  done < "$file"
  return 1
}

_verasic_load_key() {
  local key="$1"
  local current="${!key-}"
  [[ -n "$current" ]] && return 0

  local value=""
  value="$(_verasic_extract_var .github-agent.local "$key" 2>/dev/null || true)"
  if [[ -z "$value" ]]; then
    value="$(_verasic_extract_var .env.local "$key" 2>/dev/null || true)"
  fi
  [[ -n "$value" ]] || return 1
  printf -v "$key" '%s' "$value"
  export "$key"
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

_verasic_load_key GH_TOKEN || true
_verasic_load_key GH_REPO || true
