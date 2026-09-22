# App Links and Universal Links

Email and notification links use HTTPS URLs on `logmaster.live` (or staging). When the
native app is installed, the OS should open those URLs in the Capacitor WebView instead
of the browser.

## Web configuration

Path allowlists live in `config/universal-link-paths.json`. Regenerate hosted files with:

```sh
pnpm app-links:generate
```

This writes:

- `public/.well-known/apple-app-site-association` (iOS Universal Links)
- `public/.well-known/assetlinks.json` (Android App Links)

The `build` script runs the generator automatically.

### iOS

- Associated Domains are in `ios/App/App/App.entitlements` (`applinks:logmaster.live`, staging).
- After deploy, validate with Apple’s CDN cache or [Branch AASA validator](https://branch.io/resources/aasa-validator/).

### Android

1. Add SHA-256 certificate fingerprints to `config/android-app-link-fingerprints.json`
   (colon-separated, as shown in Play Console or `keytool` output).

   **Play App Signing:** use the **App signing key certificate** from Play Console →
   Setup → App signing, not only the upload key.

2. Optional: pass extra fingerprints at generate time:

   ```sh
   ANDROID_APP_LINK_SHA256_FINGERPRINTS='AA:BB:...' pnpm app-links:generate
   ```

3. Upload key fingerprint (for local debugging of release builds):

   ```sh
   keytool -list -v -keystore "$ANDROID_UPLOAD_KEYSTORE" -alias "$ANDROID_UPLOAD_KEY_ALIAS"
   ```

4. Intent filters are in `android/app/src/main/AndroidManifest.xml` (`android:autoVerify="true"`).

5. After deploy, test:

   ```sh
   adb shell pm verify-app-links --re-verify live.logmaster.app
   adb shell pm get-app-links live.logmaster.app
   ```

Until `assetlinks.json` includes valid fingerprints, Android may show a “Open with” chooser.

## In-app routing

`NativeAppLinks` handles cold start and warm `appUrlOpen` events. Push notification taps
use the same `navigateToAppLink()` helper (`src/lib/app-link-navigation.ts`).

The WebView loads the remote app (`capacitor.config.ts` `server.url`), so the same
TanStack routes (`/invite/…`, `/boats/…`, `/trips/…`, `/messages?thread=…`, etc.)
run inside the app after the link opens.

## Paths covered for email

| Source | Example path |
| --- | --- |
| Member / boat / org invite | `/invite/{token}` |
| Crew invite | `/crew/invite/{token}` |
| Magic link / verify / reset | `/api/auth/…`, `/sign-in`, `/reset-password` |
| Activity notification emails | `/boats/…`, `/orgs/…`, `/trips/…`, `/admin/job-management` |
| Message notifications | `/messages?thread=…` |

Add new first-class email destinations to `config/universal-link-paths.json`, regenerate,
and redeploy the web app (both hostnames serve the same `public/` assets).
