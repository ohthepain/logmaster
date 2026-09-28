# Photo galleries

These conventions apply to photo galleries and photo selection in Logbook2.0
on iOS, Android, desktop browsers, and mobile browsers.

1. Show photos newest first, with the newest photo at the top.
2. The first item in the gallery is always the camera, so the user can take a
   new photo. Keep it available while photos load and if library access fails.
3. Open the gallery sheet halfway up the screen, with its photo list at the
   top. Let the user drag the handle up and down to resize the sheet; scrolling
   the photos should scroll the list independently.

## Platform behavior

- Ask for camera access when the user chooses the camera. A denied photo-library
  permission must not prevent taking a photo, and choosing an existing photo
  must not require camera permission.
- Keep a Choose photo action available for the system library picker, including
  limited library access and platforms/builds without recent-photo enumeration.
  Browsers and Android currently use this fallback; their system picker controls
  its own ordering and presentation.
- Report camera and photo-library failures separately. Cancellation is not an
  error.
- The iOS recent-photo bridge returns thumbnails sorted by creation date,
  descending. Preserve that order when rendering.
- Native photos must cross the native bridge as image data, rather than being
  fetched from a capacitor:// URL by the remotely hosted HTTPS app. Keep photo
  acquisition compatible with installed app builds; getPhoto with a Base64
  result is supported by older Camera plugins as well as the current version.
- Confirm with the user before introducing native changes that require an app
  update, as required by AGENTS.md.
