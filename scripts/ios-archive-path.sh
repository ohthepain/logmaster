#!/usr/bin/env bash
# Print an xcarchive path under ~/Library/Developer/Xcode/Archives/<date>/ so Xcode Organizer lists it.
set -euo pipefail

ARCHIVE_DATE="$(date +%Y-%m-%d)"
ARCHIVE_STAMP="$(date +%Y-%m-%d\ %H.%M.%S)"
ARCHIVE_DIR="${HOME}/Library/Developer/Xcode/Archives/${ARCHIVE_DATE}"
ARCHIVE_PATH="${ARCHIVE_DIR}/Logbook2.0 ${ARCHIVE_STAMP}.xcarchive"

mkdir -p "$ARCHIVE_DIR"
printf '%s\n' "$ARCHIVE_PATH"
