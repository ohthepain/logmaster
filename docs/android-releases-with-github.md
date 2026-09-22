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
| `AWS_ROLE_ARN_BUILD_NUMBERS` | IAM role (same OIDC trust as notify) with `dynamodb:UpdateItem`, `dynamodb:GetItem`, and `dynamodb:PutItem` on the `global-build-numbers` table |

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
| `ANDROID_TESTING_URL` | **Environment variable** (or secret): internal-testing join link from Play Console, e.g. `https://play.google.com/apps/internaltest/4700471077434195460`, or closed-testing `https://play.google.com/apps/testing/live.logmaster.app`. Not a per-build `/apps/test/.../version` URL. |
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

### Global Android version codes

**Android test build** allocates the Play `versionCode` with
[ohthepain/global-build-numbers](https://github.com/ohthepain/global-build-numbers)
before signing. Values live in DynamoDB table `global-build-numbers`, partition key
attribute `project-name`, item id `logmaster-android`, numeric attribute `VERSION`.

One-time AWS setup:

1. Create the table if needed: partition key `project-name` (String). No sort key.
2. Seed `VERSION` to the **last accepted Play version code** (not the next one).
   The workflow runs `increment` on each build. Example after the first Play upload
   used code `1`: set `VERSION` to `1` so the next CI build gets `2`.

   ```sh
   aws dynamodb put-item --table-name global-build-numbers --region eu-central-1 --item '{
     "project-name": {"S": "logmaster-android"},
     "VERSION": {"N": "1"}
   }'
   ```

3. Attach DynamoDB permissions to the role referenced by `AWS_ROLE_ARN_BUILD_NUMBERS`.

Google's [tester API](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.testers)
supports Google Groups but not Play Console email lists. Keep `ANDROID_TESTER_EMAILS`
in sync with Sailors manually. A real Google Group email can instead be used if it
allows messages from the configured sender.

## Build a test release

1. Run **Android test build** on the desired branch or tag. Checkout pins the run's
   commit; the artifact metadata records the full SHA and bundle checksum.
2. Enter a display version such as `1.0`. The workflow bumps the stored build number
   in DynamoDB and uses that integer as the Play `versionCode` (must stay monotonic;
   do not reuse codes).
3. Download the signed `.aab` and JSON metadata from the run's artifact (retained 30 days).
   The artifact name includes the allocated version code.
4. Upload the AAB in Play Console's internal testing release flow and roll out there.
   A successful build does not upload, publish, or establish tester availability.

If Play ever rejects a code because the store is ahead of DynamoDB (manual upload,
failed build after increment, etc.), raise the stored `VERSION` in DynamoDB to match
the highest accepted Play code before the next CI build.

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
