#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Cap sync (staging or prod) must run before this script — see pnpm ios:archive* in package.json.

# Organizer only lists archives under ~/Library/Developer/Xcode/Archives/<date>/.
# A custom path like ios/build/*.xcarchive succeeds but never appears there.
ARCHIVE_PATH="$("$ROOT/scripts/ios-archive-path.sh")"
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
echo "==> Archive (Xcode Organizer): $ARCHIVE_PATH"
