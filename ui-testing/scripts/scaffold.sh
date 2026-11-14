#!/usr/bin/env bash
# scaffold.sh — create a Playwright UI test suite (ui-testing skill layout)
# in <project-dir>/e2e and install its dependencies.
#
# Usage: scaffold.sh <project-dir>
#
# Creates: e2e/{package.json,playwright.config.ts,coverage-report.mjs,
#          state-matrix.md,.gitignore,tests/fixtures.ts,fixtures/}
# Requires: Node >= 20 (Playwright refuses older), npm, Google Chrome.
# Never overwrites existing files; reports what it skipped.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <project-dir>" >&2
  exit 2
fi

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$(cd "$1" && pwd)/e2e"

command -v node >/dev/null || { echo "❌ node not found. Install Node 20+ (e.g. 'mise use node@20')." >&2; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 20 )); then
  echo "❌ Node $(node -v) is too old: Playwright needs 20+. Try 'mise use node@20' in $TARGET." >&2
  exit 1
fi
if [[ "$(uname)" == "Darwin" && ! -d "/Applications/Google Chrome.app" ]]; then
  echo "⚠️  Google Chrome not found; either install it or remove channel: \"chrome\" and run 'npx playwright install chromium'."
fi

mkdir -p "$TARGET/tests" "$TARGET/fixtures"

copy() { # copy <src> <dest> without overwriting
  if [[ -e "$2" ]]; then echo "⏭  kept existing ${2#"$TARGET"/}"; else cp "$1" "$2"; echo "✅ ${2#"$TARGET"/}"; fi
}
copy "$SKILL_DIR/assets/playwright.config.ts" "$TARGET/playwright.config.ts"
copy "$SKILL_DIR/assets/fixtures.ts" "$TARGET/tests/fixtures.ts"
copy "$SKILL_DIR/assets/state-matrix.md" "$TARGET/state-matrix.md"
copy "$SKILL_DIR/scripts/coverage-report.mjs" "$TARGET/coverage-report.mjs"

if [[ ! -e "$TARGET/package.json" ]]; then
  cat > "$TARGET/package.json" <<'JSON'
{
  "name": "e2e",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:update": "playwright test --update-snapshots",
    "coverage": "node coverage-report.mjs",
    "report": "playwright show-report"
  }
}
JSON
  echo "✅ package.json"
fi
if [[ ! -e "$TARGET/.gitignore" ]]; then
  printf 'node_modules/\ntest-results/\nplaywright-report/\n.coverage/\n' > "$TARGET/.gitignore"
  echo "✅ .gitignore"
fi

echo "Installing @playwright/test and @axe-core/playwright…"
(cd "$TARGET" && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install -D --silent @playwright/test @axe-core/playwright) \
  || { echo "❌ npm install failed (see above). Check your registry/network and rerun." >&2; exit 1; }

cat <<EOF

Next:
  1. Edit e2e/playwright.config.ts: PORT, webServer.command (deterministic mode), APP_SCRIPT_MATCH.
  2. Edit e2e/tests/fixtures.ts: DEFAULT_SNAPSHOT, READY_SELECTOR, SETTLED.
  3. Capture a snapshot:  curl -s http://127.0.0.1:<port>/api/<main> > e2e/fixtures/snapshot.json
  4. Fill in e2e/state-matrix.md, then write specs (see references/layer-patterns.md).
EOF
