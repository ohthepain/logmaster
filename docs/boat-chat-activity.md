# Automatic boat-chat activity

New boat changes are recorded as system events in `boat_activity` and linked to
`chat_message`. Apply Prisma migrations before deploying the application; `db push`
does not install the PostgreSQL triggers that capture these changes. There is no
historical backfill.

Capture includes boat photos, documents and versions (including asset photos),
equipment, equipment/network connections, purchases, contacts, direct boat
members, shares and share owners. Invite acceptance is captured when it creates
membership. Pending invitations are not members. Organization membership remains
an organization activity rather than an individual boat membership edit.

The database triggers write the event and chat outbox in the same transaction as
the source change. Rollback removes both. Same-resource events of the same kind
within a transaction coalesce. Document creation and its first version produce one
post. Document metadata and replacement versions are saved together. No-op writes,
sorting, preview generation and automatic system-network provisioning are silent.
Share ownership changes count as share updates. Deleting equipment records its
connections before cascading their deletion. Deleting a boat cascades its activity
and associated chat history without producing removal posts.

Events store translation keys and safe display-name snapshots, not rendered prose
or contact/accounting details. Labels are translated at display time. Media and
PDF previews reference existing storage; files are not uploaded again. The API
checks current chat membership and that the referenced resource still belongs to
the boat. Deleted resources no longer have a preview. Non-previewable files get a
download card, HTTP(S) document links get a link card, and PDFs show their first
page. Loaded activity is refreshed along with trip-log history, including older
pages of chat.

Stream receives only the existing per-recipient invalidation signal. The durable
outbox worker picks up background changes; successful boat API mutations also wake
it immediately. Existing domain notifications retain their preferences and central
scheduler; automatic boat posts do not schedule a duplicate chat push.

## Verification

The regular Vitest suite covers rendering, translations, authorization, resource
ownership, deletion, download MIME handling and notification suppression.
`src/server/messaging/boat-activity.integration.test.ts` additionally tests the
actual PostgreSQL triggers. Set `BOAT_ACTIVITY_TEST_DATABASE_URL` to an explicitly
chosen, migrated local database to enable it. Synthetic chat messages are marked
published in the same transaction that creates them, so the tests cannot publish
outbox messages to Stream or send push notifications. All synthetic records are
cleaned up.
