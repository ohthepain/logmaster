# iOS builds through Codex on the Mac Mini

Use the existing phone-to-Codex connection. Commands execute on the connected Mac
Mini using its installed Xcode and Keychain. No GitHub runner, SSH gateway, new
service account, inbound port, or GitHub signing secrets are needed. Existing
local archive/Fastlane commands continue to work.

From your phone, ask Codex in the Logmaster project:

> Build Logmaster commit FULL_COMMIT_SHA for production and export the IPA.

Later, to upload that same archive:

> Upload release RELEASE_ID to App Store Connect for TestFlight.

Codex's existing sandbox and action approvals still apply. Building may need
normal approval to access Keychain, fetch dependencies, and write Xcode caches.
Do not disable those controls or grant GitHub access to this Codex session.
The phone connection is your authorized development session, which already has
shell tools; it is not a restricted third-party trigger. A future GitHub trigger
would require a separate security boundary. This helper is not that boundary.

## Local configuration

Requires Python 3.9+, Node and pnpm on PATH, and full Xcode selected with
`xcode-select`. The helper uses the installed pnpm with `--frozen-lockfile`;
keep its version consistent across releases (the Mini currently has 10.6.2,
while web CI uses 9.15.4).

Create `secrets/ios-release.json` using `scripts/ios-release.example.json` and set
its permissions to `600`. The entire `secrets/` directory is already ignored by
Git. Set:

- `google_ios_client_id`: the existing Google iOS OAuth client ID, not a client
  secret. The app needs it for native Google Sign-In.
- `last_build_number`: at least the largest build number already uploaded to
  App Store Connect. The helper increments the maximum of this value, the fetched
  project's number, and its persistent local counter.
- Profile names if they differ from `Logmaster Distribution` and
  `Logmaster Widgets Distribution`.
- `app_store_connect`: leave `null` for export-only use. For provisioning updates
  and upload, set this object:

```json
{
  "key_path": "/Users/YOUR_USER/.appstoreconnect/private_keys/AuthKey_KEYID.p8",
  "key_id": "KEYID",
  "issuer_id": "YOUR_ISSUER_UUID"
}
```

Store the `.p8` only on the Mini, outside the checkout, with mode `600` and a
private parent directory. Never paste its contents into chat, commit it, or put
it in GitHub secrets. Give the API key only the App Store Connect access needed
for Logmaster. The script passes its local path to Xcode without reading or
printing key contents. Xcode's documented API-key authentication is used for
upload; no Apple ID password is needed by this helper.

Keep Apple Development/Distribution private keys in the Mini's Keychain and
install compatible provisioning profiles for both `live.logmaster.app` and
`live.logmaster.app.widgets`, team `RPGSNMH65P`. Archive currently uses the
project's automatic signing configuration; export uses manual distribution
profiles. Without an API key, compatible archive profiles must already be local.
The first archive/export verifies provisioning and unattended Keychain access;
a certificate inventory alone cannot prove signing will succeed. If macOS
requests signing permission, grant it to the relevant Apple signing tool rather
than enabling unrestricted access to the private key.

## Commands

Run from the repository root:

```sh
pnpm ios:release doctor
pnpm ios:release build FULL_40_CHARACTER_COMMIT_SHA
pnpm ios:release build FULL_40_CHARACTER_COMMIT_SHA --environment staging
pnpm ios:release upload RELEASE_ID
```

`build` fetches the exact SHA from `ohthepain/logmaster` into a fresh directory;
it never switches your working branch or includes uncommitted changes. It installs
the frozen pnpm lockfile, prepares Logmaster's placeholder web directory, syncs
Capacitor iOS, updates icons/Google Sign-In and both targets' build numbers, then
archives and exports. Logmaster loads the hosted production/staging app rather
than bundling the server/web application, matching the existing Capacitor setup.
Swift package resolution is restricted to the committed resolved versions.

Only request commits you trust: dependency installation and Xcode builds execute
code from the selected commit and its dependencies under your Mac account. A
fixed helper command does not sandbox that code away from your local credentials.
The helper passes the existing SSH agent only to the fixed-repository Git fetch;
dependency installation and Xcode builds do not receive the agent environment.

Artifacts, source checkout, build logs and a release manifest remain under
`ios/build/releases/RELEASE_ID/` (ignored by Git). The manifest records the exact
commit, environment, build number, IPA path and SHA-256. Builds/uploads are
serialized with a local file lock. Keep `build-number.json` when cleaning old
release directories; do not run the older release scripts concurrently.
Archive paths are printed in the local manifest; these archives are not placed
in Xcode Organizer's default archive directory.

`upload` explicitly uploads the existing archive; it does not rebuild, increment
the number, submit for App Review, or manage tester groups. Xcode may re-export
and sign during upload, so the local IPA checksum describes the local export,
not necessarily Apple's uploaded bytes. Successful upload still requires Apple
processing before the build appears in TestFlight. The helper rejects duplicate
uploads. An interrupted/failed upload is marked `uploading` or
`upload-needs-review`: check App Store Connect and the local upload log before
manually resetting its manifest state to `exported` to retry. An interrupted
build can leave `building`; start a fresh build of the same SHA after checking
that the original Xcode process has stopped. Build numbers are reserved even
when builds fail.

Keep the Mini awake and the Codex host online. A phone disconnect does not by
itself move execution off the Mini. Stopping the task, quitting the host app, or
rebooting can interrupt the build. Logs and metadata remain available locally.

## Validation

```sh
python3 scripts/test-ios-release.py
```

These tests exercise SHA validation, exact fetching, version allocation,
environment filtering, export/upload separation, and failed/duplicate uploads.
They mock Xcode and do not sign or publish an app. `doctor` checks local tools,
configuration and signing identity availability; perform a real archive/export
of a chosen commit before treating this Mini as release-ready.

References: [Codex remote connections](https://learn.chatgpt.com/docs/remote-connections),
[Apple command-line archive/export](https://developer.apple.com/library/archive/technotes/tn2339/_index.html),
and the installed Xcode's `xcodebuild -help` for export and API authentication flags.
