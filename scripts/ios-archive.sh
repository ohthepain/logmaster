#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Sync Capacitor (production API)"
pnpm cap:sync:prod

echo "==> Sync iOS app icon"
node scripts/sync-ios-app-icon.mjs

ARCHIVE_PATH="$ROOT/ios/build/Logbook2.0.xcarchive"
EXPORT_PATH="$ROOT/ios/build/export"
EXPORT_OPTIONS="$ROOT/ios/ExportOptions.plist"

mkdir -p "$ROOT/ios/build"

echo "==> Archive (Release)"
xcodebuild \
  -project "$ROOT/ios/App/App.xcodeproj" \
  -scheme Logbook2.0 \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=RPGSNMH65P \
  archive

echo "==> Export .ipa"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates

echo "==> Done: $EXPORT_PATH/Logbook2.0.ipa"
