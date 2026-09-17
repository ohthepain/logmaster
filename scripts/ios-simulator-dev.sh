#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="${IOS_SIMULATOR_ID:-80B83655-1822-458A-958C-C3CE82A2FDD6}"
DEV_URL="${CAP_DEV_SERVER_URL:-http://localhost:3020}"

echo "[ios-sim] Sync Capacitor (server.url=$DEV_URL)..."
CAP_DEV_SERVER_URL="$DEV_URL" pnpm cap:sync >/dev/null

echo "[ios-sim] Build for simulator $TARGET..."
CAP_DEV_SERVER_URL="$DEV_URL" pnpm exec cap run ios --target "$TARGET" --no-sync || true

APP="$ROOT/ios/DerivedData/$TARGET/Build/Products/Debug-iphonesimulator/Logbook2.0.app"
if [[ ! -d "$APP" ]]; then
  echo "[ios-sim] Build product not found at $APP" >&2
  exit 1
fi

xcrun simctl boot "$TARGET" 2>/dev/null || true
open -a Simulator >/dev/null 2>&1 || true
xcrun simctl install "$TARGET" "$APP"
xcrun simctl launch "$TARGET" live.logmaster.app
echo "[ios-sim] Launched. Ensure \`pnpm dev\` is running on port 3020."
