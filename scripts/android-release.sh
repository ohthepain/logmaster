#!/usr/bin/env bash
set -euo pipefail

# Passwords are read by jarsigner from the environment, never command arguments.
: "${ANDROID_VERSION_CODE:?Set a version code higher than the last Play upload}"
: "${ANDROID_VERSION_NAME:?Set the display version}"
: "${ANDROID_UPLOAD_KEYSTORE:?Set the path to the existing upload keystore}"
: "${ANDROID_UPLOAD_STORE_PASSWORD:?Set the keystore password}"
: "${ANDROID_UPLOAD_KEY_ALIAS:?Set the upload key alias}"
[[ "$ANDROID_VERSION_CODE" =~ ^[1-9][0-9]{0,9}$ ]] &&
  (( ANDROID_VERSION_CODE <= 2100000000 )) || { echo 'Invalid version code'; exit 1; }
[[ "$ANDROID_VERSION_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9.+_-]{0,49}$ ]] || { echo 'Invalid version name'; exit 1; }
[[ -f "$ANDROID_UPLOAD_KEYSTORE" ]] || { echo 'Upload keystore not found'; exit 1; }
export ANDROID_UPLOAD_KEY_PASSWORD="${ANDROID_UPLOAD_KEY_PASSWORD:-$ANDROID_UPLOAD_STORE_PASSWORD}"
export CAP_REMOTE_APP_URL=https://logmaster.live
unset CAP_DEV_SERVER_URL

node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const config = JSON.parse(readFileSync("android/app/google-services.json", "utf8"));
  if (!config.client?.some(c => c.client_info?.android_client_info?.package_name === "live.logmaster.app")) {
    throw new Error("Firebase configuration does not match live.logmaster.app");
  }
'
pnpm cap:prepare
pnpm exec cap sync android
./android/gradlew -p android bundleRelease --console=plain \
  "-PreleaseVersionCode=$ANDROID_VERSION_CODE" "-PreleaseVersionName=$ANDROID_VERSION_NAME"
mkdir -p android/build/release-artifacts
artifact="android/build/release-artifacts/logmaster-${ANDROID_VERSION_NAME}-${ANDROID_VERSION_CODE}.aab"
jarsigner -keystore "$ANDROID_UPLOAD_KEYSTORE" \
  -storepass:env ANDROID_UPLOAD_STORE_PASSWORD -keypass:env ANDROID_UPLOAD_KEY_PASSWORD \
  -signedjar "$artifact" android/app/build/outputs/bundle/release/app-release.aab "$ANDROID_UPLOAD_KEY_ALIAS"
jarsigner -verify "$artifact"
# Verify that this is signed, since jarsigner -verify alone also accepts unsigned ZIPs.
unzip -Z1 "$artifact" | grep -E '^META-INF/[^/]+\.(RSA|EC|DSA)$' > /dev/null
ARTIFACT="$artifact" node --input-type=module -e '
  import { readFileSync, writeFileSync } from "node:fs";
  import { createHash } from "node:crypto";
  import { execFileSync } from "node:child_process";
  const artifact = process.env.ARTIFACT;
  writeFileSync(artifact + ".json", JSON.stringify({
    commit: execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim(),
    versionCode: Number(process.env.ANDROID_VERSION_CODE),
    versionName: process.env.ANDROID_VERSION_NAME,
    url: process.env.CAP_REMOTE_APP_URL,
    sha256: createHash("sha256").update(readFileSync(artifact)).digest("hex"),
  }, null, 2) + "\n");
'
echo "Signed bundle: $artifact (not uploaded to Google Play)"
