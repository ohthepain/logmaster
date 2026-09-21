# Android builds and Sailors announcements

Two independent GitHub Actions workflows are available under **Actions → Run workflow**
after these files are merged into the default branch. Both are manual only and run
on GitHub-hosted Linux runners. They do not change the iOS release workflow.

## One-time setup

Create a GitHub environment named `android-release`. Restrict it to trusted release
branches: workflow code on the selected branch can access its release secrets.
Add these environment secrets:

| Secret | Value |
| --- | --- |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | Base64 of the existing `secrets/android-upload/upload.p12` |
| `ANDROID_UPLOAD_STORE_PASSWORD` | Contents of `secrets/android-upload/store-password.txt` |
| `ANDROID_TESTER_EMAILS` | Sailors tester addresses copied from Play Console, separated by commas or newlines |
| `AWS_ROLE_ARN_NOTIFY` | An AWS role trusted for this repository's `android-release` environment, with permission to send via SES |

Reuse the upload key used for the first Play upload. Do not generate a replacement.
The Android upload key is uploaded to GitHub only when you configure this secret;
it is distinct from all iOS signing credentials. Keep a secure backup. The workflow
restores it to a temporary file and removes it after signing; only the signed AAB
and non-secret build metadata are retained as artifacts.

With GitHub CLI authenticated, configure the existing key without printing it:

```sh
base64 < secrets/android-upload/upload.p12 | gh secret set ANDROID_UPLOAD_KEYSTORE_BASE64 --env android-release
gh secret set ANDROID_UPLOAD_STORE_PASSWORD --env android-release < secrets/android-upload/store-password.txt
```

Add environment variables:

| Variable | Value |
| --- | --- |
| `ANDROID_UPLOAD_KEY_ALIAS` | `logmaster-upload` (default) |
| `ANDROID_TESTING_URL` | Copy the opt-in link from Play Console; expected `https://play.google.com/apps/testing/live.logmaster.app` |
| `AWS_SES_FROM_EMAIL` | A verified SES sender address, ideally a monitored mailbox for replies |

The tracked Android `google-services.json` supplies client Firebase configuration.
No Firebase service-account private key is needed in the Android build.

For AWS OIDC, use the existing GitHub OIDC provider in your AWS account and a dedicated
notification role. Its trust conditions must match audience `sts.amazonaws.com` and
subject `repo:OWNER/REPOSITORY:environment:android-release` (substitute this repository).
Grant `ses:SendEmail` only on the verified sending identity in `eu-central-1`, optionally
constrained by `ses:FromAddress`. The existing deploy role is not assumed to have SES
permissions. SES sandbox accounts can send only to verified recipients; production
access is needed for an ordinary tester list. These workflows do not create the role,
change SES account limits, or configure GitHub secrets automatically.

Google's [tester API](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.testers)
supports Google Groups but not Play Console email lists. Keep `ANDROID_TESTER_EMAILS`
in sync with Sailors manually. A real Google Group email can instead be used if it
allows messages from the configured sender.

## Build a test release

1. Run **Android test build** on the desired branch or tag. Checkout pins the run's
   commit; the artifact metadata records the full SHA and bundle checksum.
2. Supply a version code greater than every previously accepted Play upload (the
   first local bundle used `1`; use at least `2` next) and a display version such as `1.0`.
   Version codes are not allocated automatically and must not be reused.
3. Download the signed `.aab` and JSON metadata from the run's artifact (retained 30 days).
4. Upload the AAB in Play Console's internal testing release flow and roll out there.
   A successful build does not upload, publish, or establish tester availability.

The build uses Java 21, API 36, Build Tools 35 and the production web app. Native
assets contain a placeholder: the shell loads `https://logmaster.live`, so building
a branch does not deploy that branch's web code. Release numbers are passed to
Gradle without modifying tracked version defaults.

For a local build, run `bash scripts/android-release.sh` with `ANDROID_VERSION_CODE`,
`ANDROID_VERSION_NAME`, `ANDROID_UPLOAD_KEYSTORE`, `ANDROID_UPLOAD_STORE_PASSWORD`,
and `ANDROID_UPLOAD_KEY_ALIAS` set. `ANDROID_UPLOAD_KEY_PASSWORD` is optional and
defaults to the store password. Use Java 21 and your installed Android SDK.

## Notify Sailors

1. Verify in Play Console that the intended release is available to internal testers.
2. Run **Notify Sailors Android testers** with a release label such as `1.0 (build 2)`.
   Leave **Preview only** checked first. The run prints the message and recipient
   count without sending email or printing the addresses.
3. Run again with **Preview only** unchecked and **I verified this release is available**
   checked. This sends one email per deduplicated address, keeping recipients private.

The workflow sends email, not a Firebase push or a Play Console system notification.
It does not add testers or change their access. SES acceptance is not confirmed inbox
delivery. Failed requests produce a failed run and counts; sends are not automatically
retried because delivery after a network failure can be uncertain. Re-running a send
will send again to the entire configured list, including previous successes. For a
partial failure, investigate before retrying and temporarily restrict the list to
the recipients that need another message. Failure logs identify recipient positions
in the deduplicated configured order without exposing addresses.

No announcement is triggered by a build, push, or deployment.

References: [manual GitHub workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[Android command-line bundles](https://developer.android.com/build/building-cmdline).
