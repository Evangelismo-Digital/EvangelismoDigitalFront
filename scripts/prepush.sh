#!/usr/bin/env bash
# Pre-push quality gate: lint -> unit -> e2e -> mutation (changed lines only).
# Usage: scripts/prepush.sh [base-ref]   (default: merge-base with origin/main)
# Env:   PREPUSH_ONLY=lint|unit|e2e|mutation  re-run a single step after fixing it
#        PREPUSH_DRYRUN=1                     print the plan and mutation scope only
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

base="${1:-}"
if [ -z "$base" ]; then
  base="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)"
fi
only="${PREPUSH_ONLY:-}"

step() { [ -z "$only" ] || [ "$only" = "$1" ]; }
banner() { printf '\n=== [prepush] %s ===\n' "$1"; }

echo "[prepush] base: $base  head: $(git rev-parse --short HEAD)"
if [ -n "${PREPUSH_DRYRUN:-}" ]; then
  echo "[prepush] steps: lint (eslint --max-warnings 0 + tsc -b) | unit (vitest run) | e2e (playwright, 3 viewports) | mutation (stryker, changed src lines)"
  npx tsx scripts/mutation-gate.ts "$base" --dry-run
  exit 0
fi

if step lint; then
  banner "lint"
  npx eslint . --max-warnings 0
  npx tsc -b
fi
if step unit; then
  banner "unit"
  npx vitest run
fi
if step e2e; then
  banner "e2e"
  npx playwright test
fi
if step mutation; then
  banner "mutation"
  npx tsx scripts/mutation-gate.ts "$base"
fi

echo; echo "[prepush] gate passed"
