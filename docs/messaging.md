# Messaging

V1 adds `/messages` and a messages button beside the profile button. The app owns the inbox, bubbles, object links, history, unread counts and all authorization. Photos and videos are supported; response-card rendering remains reserved for v2.

Received messages have a heart button: each tap adds one like from your account, stored in `chat_message_like` as a per-user `count` on the `(messageId, userId)` key. The bubble shows the combined total across all members. Your heart stays filled once you have liked at least once. Liking floats a decorative heart upward at a random horizontal position; reduced-motion preferences disable the animation. Failed saves restore the previous state. Likes refresh for all loaded messages (including older history) on the chat's existing foreground refresh cadence, at least every 15 seconds. Likes do not send push notifications or create Stream messages. Apply migrations `20260921150000_message_likes` and `20260921180000_message_like_count` before deploying this UI/API.

## Ownership and replacing Stream

PostgreSQL is the source of truth (`chat_message`, `chat_read`). Thread IDs are provider independent. Object threads are `org:<id>`, `boat:<id>`, `trip:<id>`, and `asset:<id>`; private conversations use a hash of the sorted pair of Logmaster user IDs. No empty conversation needs to be provisioned externally.

Stream is a **live event transport**, not the history database. The server upserts our user identities and creates one private, read-only `logmaster_events` channel per user. Its `message.new` events contain custom `logmaster` fields with the version, local message ID, thread ID, and a response-card envelope reserved for v2. They contain no message text, attachment URL, or thread member list. Custom React components fetch the actual conversation through the authenticated Logmaster API. This deliberate per-user event design avoids copying private content to Stream, stale remote membership exposing content, and provider channel membership being mistaken for authorization. Threads and their automatically calculated membership live in Logmaster.

To stop using Stream, set `MESSAGING_PROVIDER=polling`, restart the app and workers, and remove the webhook in the Stream dashboard. Existing live clients switch on their next session renewal/page load. To stop billing promptly, also revoke/disable the Stream application after disconnecting clients. History, references, unread state, permissions and push remain operational without migration. Polling refreshes while chat is visible. An alternative live provider only needs the server `MessagingProvider` and browser `ChatRealtime` adapters; the UI imports no Stream presentation SDK.

## Membership

Membership is calculated from current account relationships for every list/read/send and again at push delivery. There is no vendor membership cache to reconcile.

- Organisation: creator plus all organisation members.
- Boat: owner, explicit members, share owners, and members/creator of its organisation.
- Asset: inherits its boat's members.
- Trip: **only the trip creator and linked users in that trip's selected `crewMemberIds`**. Boat access alone does not grant trip-chat access. Unlinked local crew records cannot sign in and receive chat.
- Private: accepted friend connections, one thread per pair regardless of direction.

Public or unlisted object visibility and scoped contact grants do not grant chat access. Current members can read the conversation's history; removed members lose access on the next request. Selected trip crew can view the linked trip, but this does not grant boat or trip editing privileges. Disconnected/private thread history remains in our database for a future reconnection.

Object names are recognized case-insensitively at whole-name boundaries. The server canonicalizes capitalization and saves reference offsets. The renderer only turns a reference into a link if its target is currently accessible to the viewer. Ambiguous names, email addresses and URL fragments are not guessed. Text is rendered as React text, never raw HTML.

## Setup

1. Apply the checked-in database migration with `pnpm db:migrate:deploy` before deploying the app/worker code.
2. Set server-only `STREAM_API_KEY` and `STREAM_API_SECRET` (never a `VITE_` secret). With neither credential configured, messaging uses polling. Terraform supplies blank SecureString placeholders whose values can be set through your existing SSM process. Use separate Stream applications per environment.
3. Run `pnpm messaging:configure` using the server credentials. This creates/updates the dedicated `logmaster_events` type with member read access only, Stream push disabled, no replies/reactions, and seven-day event retention. It does not modify other channel types. The token endpoint checks that push and client-write grants have not been enabled. Client tokens expire after one hour and are renewed through our authenticated backend.
4. In Stream, enable permissions v2 and leave authentication checks enabled. Register `https://<app-host>/api/messaging/webhooks/stream` for `message.new` events. Keep payload compression off. The handler verifies the exact raw body's HMAC using `X-Signature` before parsing. Do not configure APNs/FCM/Web Push devices with Stream. `skip_push` is also set on every published event.
5. The production server starts and supervises the background worker automatically. For local development, run `pnpm worker`. The message and push outboxes recover at least once a minute, with immediate queue wake-ups for new messages. Check `chat_message.publishedAt` backlog and `push_dispatch.failedAt` for failures.

Reference: [Stream plain JavaScript SDK](https://getstream.io/chat/docs/javascript/), [channel features and push setting](https://getstream.io/chat/docs/node/channel-features/), [permissions](https://getstream.io/chat/docs/node/chat-permission-policies/), [webhooks](https://getstream.io/docs/platform/webhooks/).

## First production deployment

Get the API key and secret from your Stream Chat application's dashboard overview and put them in the gitignored `.env` as `STREAM_API_KEY` and `STREAM_API_SECRET`. Keep production and staging in separate Stream apps. The bucket name is an ordinary setting; S3 uses the ECS task role and needs no new access key.

On `main`, use this order:

```bash
# Review the production plan, then apply the infrastructure changes.
pnpm tf:plan:prod
pnpm tf:apply:prod

# Configure the Stream app using the local credentials.
pnpm messaging:configure

# Write both values to Terraform-created SSM SecureString parameters.
pnpm messaging:secrets production

# After setting the Stream message.new webhook described above:
git push origin main
```

The SSM paths are `/logmaster/production/STREAM_API_KEY` and `/logmaster/production/STREAM_API_SECRET`, in `eu-central-1`. The helper requires both SecureString parameters to exist before writing either, uses an owner-only temporary input file (removed immediately afterward) rather than process arguments, and does not print them. Terraform's `ignore_changes = [value]` preserves these updates. Do not put the values in tfvars or GitHub secrets. Access to Terraform state remains sensitive: providers may refresh SSM values into state even when changes are ignored.

The current CI workflow builds and deploys the application but **does not run Terraform apply**. Applying first is necessary to update the ECS task definition and execution-role permissions. New containers run `prisma migrate deploy` on startup. The push to `main` triggers the production deployment and the new tasks receive the SSM values. Updating SSM alone does not refresh a running container; for later rotations use `pnpm messaging:secrets production --redeploy` after configuring the replacement Stream app if needed.

If parameters were created manually before Terraform, import each into the production workspace (`aws_ssm_parameter.stream_api_key` and `aws_ssm_parameter.stream_api_secret`) rather than attempting to create them again.

## Notification manager and lifecycle

All server push producers now use the exported `pushNotificationManager` singleton. It writes a durable, deduplicated outbox keyed by notification and recipient, supports scheduled delivery and priority (chat is 10, existing activity notifications default to 0), and leases jobs across worker processes. Existing email delivery is unchanged. Transient push failures are retried with backoff, then marked failed after eight attempts. As with APNs/FCM/Web Push generally, delivery is at least once: a worker crash after a provider accepts a push but before acknowledgement can cause a duplicate. Per-device failures can also resend to successful devices during retry.

Only the mounted, foreground chat page holds a Stream connection. Browser visibility and Capacitor app-state changes disconnect it; resuming reconnects and refreshes. Multiple tabs have independent presence leases. A heartbeat expires after 45 seconds so a killed app cannot suppress notifications indefinitely. Notification delivery defers while any chat session is active, then checks current membership, read watermarks, push defaults and mute preferences. Read messages and the sender's own messages are suppressed. There may be up to a minute of recovery-worker delay following an abrupt close. Push payloads use a generic preview and deep-link directly to the conversation.

Webhook retries and the durable message outbox share the same deduplication key. Push scheduling does not depend on Stream being healthy. Message send retries reuse a client UUID; read watermarks advance monotonically, including messages sharing a timestamp. API input is bounded to 5,000 text characters and sends are rate limited per user (60 per minute).

## Photos and videos

The landscape button appears beside an empty composer. It opens a tray with a multi-select OS photo/video picker and separate camera/video capture inputs. Focusing the text box closes the tray; typing hides the landscape button. Selected previews remain available for captions and removal, and uploads begin only on Send. Failed uploads/sends preserve the draft. Each message supports up to 10 items, each at most 100 MB. Common raster photos (including HEIC/HEIF) and MP4, MOV, WebM, Ogg and 3GP video containers are accepted. Playback depends on the device's codecs; unsupported previews offer the original file. iOS video capture with audio requires an app build containing the microphone usage description in `Info.plist`.

Apply `20260921170000_message_media` before deploying. Media metadata and ordered message attachments live in PostgreSQL. The browser calculates SHA-256 before requesting an upload. The backend reuses a completed upload belonging to the current account, or an attachment already shared in the current authorized conversation. Knowing another user's checksum grants no access. Object keys are scoped to the uploader and checksum, so the same bytes uploaded by unrelated accounts remain isolated.

Uploads go directly to the private **`logmaster-message-media`** S3 bucket using a short-lived signed PUT bound to the exact size, content type, SHA-256 and `If-None-Match: *`. S3 validates the checksum and prevents overwrites; the backend checks the stored size, type and checksum before accepting attachments. A retry also checks for an already-finished PUT before uploading again. Stream never stores these files or their URLs. `S3_BUCKET_MESSAGE_MEDIA` selects a separate staging bucket. Terraform owns production CORS for signed PUTs, with explicit app/native/development origins; the existing bucket can remain externally managed. `manage_message_media_bucket=true` enables optional bucket provisioning for an owning state.

Reads go through authenticated Logmaster endpoints with current thread membership checks, range support and checksum ETags. Photos load near the viewport; videos load on demand and support inline playback. Downloaded bytes are verified against SHA-256 and cached by account/checksum (up to 200 MB or 40 files). Each view rechecks access before using cached bytes, including after reload. Concurrent views share downloads, cache failures fall back to network, and logout clears the media caches. The OS may evict cached files when storage is scarce.

Response-card custom fields remain reserved; clients cannot inject card actions, sender identities, S3 keys or arbitrary attachment URLs.

## Validation

- `pnpm typecheck`
- `pnpm exec vitest run --exclude 'ios/**'` (excludes archived iOS build checkouts that contain old test suites and their own React installations)
- `pnpm build`
- Targeted ESLint on changed TypeScript files.

Tests cover membership boundaries, crew-only trips, object references, authentication, spoofed sends, pagination, webhook signatures, retry IDs, priority/deferred push delivery, and foreground/background cleanup. Browser visual checks use mocked data on desktop and mobile. Real Stream credentials, S3 provisioning and device delivery must be verified in staging after configuration; local tests do not prove those external services are configured.

## Response cards

`/admin/response-cards` is restricted to platform admins. Choose a language, add a phrase, then drop or select multiple images. “Link an existing card” shares a card across expressions (including across languages); “Add phrase with these cards” creates another expression with the same associations. The card library controls titles and enabled state. Removing an expression only removes its associations. Removing a card retires it and unlinks all expressions; immutable assets and sent message snapshots remain available in history.

Cards are stored in `messaging_card`, expressions in `messaging_expression`, and their many-to-many associations in `messaging_card_link`. PNG/JPEG and static or animated GIF/WebP are accepted, up to 10 MB, 4096 pixels per frame and 300 frames. The server inspects image contents; SVG is not accepted. Assets are deduplicated by SHA-256 and stored privately under `sha256/<checksum>` in `logmaster-messaging-cards` (`S3_BUCKET_MESSAGING_CARDS` override). Authenticated image responses support browser caching. Uploads go through the admin API, so this bucket needs no browser CORS policy.

The composer waits 550 ms after typing a phrase (up to 200 characters). Matching uses the entire phrase, Unicode normalization, case folding, collapsed whitespace and ignored surrounding punctuation; expressions are literal strings, not regular expressions. English inputs match English directly. Other languages produce ordered, deduplicated suggestions from the selected language, an English translation, then the original text matched against English. Translation uses the existing server-only `OPENAI_API_KEY` and TanStack AI adapter, with a five-second timeout, a bounded five-minute in-memory cache and 20 uncached translations per account per minute per server process. Drafts are sent to OpenAI for translation, but are not persisted or logged by the matching service. If translation is unconfigured, unavailable, or rate limited, direct local-language and English matching remains available and the composer indicates the limitation.

Selecting a card stages it above the composer. Send posts the card and any current text/media; removing the text permits a card-only message. The server resolves only active card IDs and writes a provider-neutral, versioned snapshot into `ChatMessage.responseCard`. Arbitrary client card JSON or asset URLs are rejected. Stream remains only a realtime invalidation transport, with the existing app notification pipeline.

Deployment: apply migration `20260921210000_response_cards` and Terraform's ECS environment/task-role changes. The existing `logmaster-messaging-cards` bucket is private and AES256 encrypted. Bucket resources are optional (`manage_messaging_cards_bucket`); leave false for this existing externally managed bucket, or import it before enabling management. Other environments should set their own bucket name. No additional secret is required beyond the existing OpenAI key. This change does not itself deploy the app or apply production database migrations.

## Trip log entries in chat

Logbook sync writes one `ChatMessage` per `LogEntry` in the same database transaction, using a unique `logEntryId`. Offline retries keep the original message ID and delivery state. New items are ordered by server arrival so delayed offline entries can still be unread; their original log timestamps are displayed. Migration `20260921230000_trip_chat_log` adds existing entries in historical order with delivery already marked complete, without retrospective notifications.

Chat reads canonical entry content and media, so edits appear without duplicate posts. Deleted entries are excluded from the lobby, unread counts and history; already loaded log items are refreshed on each chat refresh, including older pages. Trip/log hard deletion cascades to linked chat messages. Delivery uses the trip's creator to resolve current selected-crew membership, even when the log editor has broader boat permissions, and suppresses pending notifications for deleted logs.

Navigation events and notes render outside message bubbles. Event labels are translated at display time through all 17 catalogs and support admin translation overrides. Photo/media/voice entries use the regular media viewer; hourly logs use a 288px-wide, 4:3 map with a position marker and map attribution. Notes retain their original user-written content.

New device-local photos, videos and recordings are uploaded through the existing checksum-based, private `logmaster-message-media` storage before syncing their associations. Temporary blob URLs are converted to durable data URLs before IndexedDB storage so offline recordings survive closing the composer. Upload APIs require trip editing permission; read APIs check current access, and chat media reads require selected-crew chat membership. Logbook editors cannot reuse attachments shared only in private chat. Legacy inline images/audio/video and existing S3 story assets remain readable through an authorized trip-chat proxy. Historical device-only blob URLs that are no longer valid cannot be recovered from the server.
