#!/usr/bin/env bash
set -euo pipefail

SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

assert() {
  local name="$1" cmd="$2"
  if ( eval "cd \"$TMP/repo\" && $cmd" ); then
    echo "PASS: $name"
    pass=$((pass + 1))
  else
    echo "FAIL: $name"
    fail=$((fail + 1))
  fi
}

assert_fail() {
  local name="$1" cmd="$2"
  if ( eval "cd \"$TMP/repo\" && $cmd" ); then
    echo "FAIL (expected error): $name"
    fail=$((fail + 1))
  else
    echo "PASS: $name"
    pass=$((pass + 1))
  fi
}

mkdir -p "$TMP/repo/.cursor/skills"
cp -r "$SKILL_ROOT" "$TMP/repo/.cursor/skills/verasic-github-env"
cd "$TMP/repo"
git init -q -b main
git remote add origin git@github.com:Milkywayrules/usecharator.git

bash .cursor/skills/verasic-github-env/scripts/bootstrap.sh >/dev/null
assert "creates .envrc" "test -f .envrc"
assert "creates .env.example with GH_REPO" "grep -q '^GH_REPO=Milkywayrules/usecharator' .env.example"
assert "creates github-agent example" "test -f .github-agent.local.example"

bash .cursor/skills/verasic-github-env/scripts/bootstrap.sh >/dev/null
count="$(grep -c '^GH_TOKEN=' .env.example || true)"
if [[ "$count" -eq 1 ]]; then
  echo "PASS: bootstrap idempotent"
  pass=$((pass + 1))
else
  echo "FAIL: bootstrap idempotent (count=$count)"
  fail=$((fail + 1))
fi

printf '%s\n' 'GH_TOKEN=fake_token_for_test' 'GH_REPO=Milkywayrules/usecharator' > .github-agent.local
chmod 600 .github-agent.local
assert_fail "check-gh rejects fake token" "bash .cursor/skills/verasic-github-env/scripts/check-gh.sh"

rm -f .github-agent.local
assert_fail "check-gh missing token" "bash .cursor/skills/verasic-github-env/scripts/check-gh.sh"

printf '%s\n' '.env*' > .gitignore
bash .cursor/skills/verasic-github-env/scripts/bootstrap.sh >/dev/null
if git check-ignore -q .env.example 2>/dev/null; then
  echo "FAIL: .env.example still ignored after .env* bootstrap"
  fail=$((fail + 1))
else
  echo "PASS: .env.example committable with .env* ignore"
  pass=$((pass + 1))
fi

echo "---"
echo "regression: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
