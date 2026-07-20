#!/usr/bin/env bash
set -euo pipefail
web_root="$(cd "$(dirname "$0")/.." && pwd)"
web_src="$web_root/src"
violations=$(grep -R "addEventListener([\"']keydown" "$web_src" \
  --include="*.ts" --include="*.tsx" \
  | grep -v "/keyboard/" || true)
if [[ -n "$violations" ]]; then
  echo "keydown listeners must live under apps/web/src/keyboard:" >&2
  echo "$violations" >&2
  exit 1
fi
echo "keyboard-listener check: ok"
