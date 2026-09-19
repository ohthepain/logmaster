# Android Firebase notifications

Android sends use FCM HTTP v1 with a server-side OAuth bearer token. The retired
`FCM_SERVER_KEY` setting is no longer used. iOS uses APNs and browsers use Web Push.

## Firebase and Android setup

1. In the Firebase project, register the Android app with package name
   `live.logmaster.app`. Download its `google-services.json` to
   `android/app/google-services.json`. This is client project configuration,
   not the server's private service-account JSON.
2. Enable the **Firebase Cloud Messaging API (V1)** in that project.
3. Give the server's service account the **Firebase Cloud Messaging API Admin**
   role (`roles/firebasecloudmessaging.admin`) on the target project.
4. Set server-only `FCM_PROJECT_ID` to that project's ID. It must match the project
   used by the Android app's registration tokens. A blank value disables sending.
5. Configure authentication using one of the options below, restart the server,
   run `pnpm cap:sync:staging` (or `pnpm cap:sync:prod`), and rebuild Android.

Capacitor already registers FCM tokens and stores them through the authenticated
push-device API. The Android manifest includes notification permission; users
must grant it. Existing tokens from the same Firebase project remain usable.

## Server authentication

For local development, save the service-account JSON in the gitignored
`secrets/` directory or outside the checkout. Set `GOOGLE_APPLICATION_CREDENTIALS`
to its absolute path. The Google authentication library uses Application Default
Credentials (ADC) and caches/refreshes short-lived OAuth tokens with the
`https://www.googleapis.com/auth/firebase.messaging` scope.

For ECS, use `FCM_SERVICE_ACCOUNT_JSON` containing the complete JSON credential,
injected at runtime from SSM SecureString. Inline credentials take precedence
over ADC. Never put these credentials in `VITE_` variables, Android assets,
`google-services.json`, Docker build arguments, or committed configuration.
The Docker build excludes `secrets/`.

The Terraform stack creates initially blank parameters and grants the ECS
execution role access to them:

- `/logmaster/{env}/FCM_PROJECT_ID`
- `/logmaster/{env}/FCM_SERVICE_ACCOUNT_JSON`

Apply the infrastructure changes first. Set the project ID and upload the JSON
using a local file (without printing the key or placing its contents in shell
history), for example for staging:

```sh
aws ssm put-parameter --region eu-central-1 \
  --name /logmaster/staging/FCM_PROJECT_ID --type SecureString \
  --value YOUR_FIREBASE_PROJECT_ID --overwrite
aws ssm put-parameter --region eu-central-1 \
  --name /logmaster/staging/FCM_SERVICE_ACCOUNT_JSON --type SecureString \
  --value file://secrets/firebase-service-account.json --overwrite
```

Deploy the updated server and start new ECS tasks after changing the parameters;
existing tasks retain their previous environment. Terraform ignores subsequent
value changes so it will not overwrite credentials on the next apply.

## Verification and errors

On an Android device, sign in and enable notifications. Trigger a notification
for that user with push delivery enabled. Check foreground display, background
notification display, and tapping the notification to open its link. The payload
includes `linkUrl` and `notificationId` as string data fields.

Server logs use the `notification.fcm` action with `fcm_not_configured`,
`fcm_auth_failed`, `fcm_http_<status>`, `fcm_request_failed`, or `fcm_unregistered`.
Credentials, access tokens, device tokens, and raw provider errors are not logged.
Only an FCM-specific `UNREGISTERED` response removes the device. Auth failures,
sender mismatch, invalid payloads, rate limits, generic 404s, and outages preserve
it. Failed sends are reported; this change does not add queued delivery retries.
A successful API send confirms FCM acceptance, not device delivery.

References: [HTTP v1 and authentication](https://firebase.google.com/docs/cloud-messaging/send/v1-api),
[FCM error codes](https://firebase.google.com/docs/cloud-messaging/error-codes).
