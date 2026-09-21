# Messaging

V1 adds `/messages` and a messages button beside the profile button. The app owns the inbox, bubbles, object links, history, unread counts and all authorization. Media/response-card rendering is reserved for v2.

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

## Media and response cards in v2

The provider-neutral `ResponseCard` and versioned custom fields reserve space for future cards. V1 only accepts text; clients cannot inject card actions, sender identity or arbitrary object URLs. Card rendering/actions and attachment upload UI are not enabled yet.

The authorized storage boundary in `src/server/messaging/media.ts` uses private S3 objects in **`logmaster-message-media`**, with encryption and a 20 MB size limit, and never Stream uploads. `S3_BUCKET_MESSAGE_MEDIA` can select an isolated staging bucket. Terraform includes optional private bucket provisioning (public access blocked, versioning, encryption), app IAM access and the environment variable. Set `manage_message_media_bucket=true` in exactly one owning Terraform state; import an existing bucket instead of creating it twice. Nothing in this change creates or modifies a cloud bucket until Terraform is applied. Content verification, media metadata persistence, upload endpoints/UI and retention policy must be completed with v2.

## Validation

- `pnpm typecheck`
- `pnpm exec vitest run --exclude 'ios/**'` (excludes archived iOS build checkouts that contain old test suites and their own React installations)
- `pnpm build`
- Targeted ESLint on changed TypeScript files.

Tests cover membership boundaries, crew-only trips, object references, authentication, spoofed sends, pagination, webhook signatures, retry IDs, priority/deferred push delivery, and foreground/background cleanup. Browser visual checks use mocked data on desktop and mobile. Real Stream credentials, S3 provisioning and device delivery must be verified in staging after configuration; local tests do not prove those external services are configured.
