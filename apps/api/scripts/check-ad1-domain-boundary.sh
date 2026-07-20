#!/usr/bin/env bash
set -euo pipefail
api_root="$(cd "$(dirname "$0")/.." && pwd)"
scan_roots=("$api_root/src/routes")
if [[ -d "$api_root/src/mcp" ]]; then
  scan_roots+=("$api_root/src/mcp")
fi

patterns=(
  'from "@usebugreport/db"'
  "from '@usebugreport/db'"
  'from "@usebugreport/storage"'
  "from '@usebugreport/storage'"
  'from "drizzle-orm"'
  "from 'drizzle-orm'"
  'createR2Client'
)

violations=""
for root_dir in "${scan_roots[@]}"; do
  for pattern in "${patterns[@]}"; do
    # shellcheck disable=SC2016
    hits=$(grep -R --include='*.ts' --include='*.tsx' -n "$pattern" "$root_dir" 2>/dev/null || true)
    if [[ -n "$hits" ]]; then
      violations+="$hits"$'\n'
    fi
  done
done

if [[ -n "$violations" ]]; then
  echo "AD-1 violation: routes/mcp must not import Drizzle, @usebugreport/db, or R2 clients (FR-18)." >&2
  echo "$violations" >&2
  exit 1
fi

echo "ad1-domain-boundary check: ok"
