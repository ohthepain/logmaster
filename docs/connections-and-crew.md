# Connections, membership, crew and private chats

Connections are explicit, mutual relationships between accounts. A request or emailed invitation must be accepted. Removing a connection does not affect a trip, membership, or private conversation. Membership invitations only establish membership; referral accounting does not create connections.

The Connections page shows saved connections, requests, and current co-members. Boat owners, explicit boat members and share owners can message one another. Current consortium members, including its owners, can message one another. The historical creator field does not preserve chat access after membership ends. Co-membership does not create a saved connection. A shared address-book contact (even one linked to an account or given scoped resource access) does not grant messaging access.

Boat joins, share assignments and attaching a boat to a consortium do not add consortium members. Existing consortium memberships are preserved because their original intent cannot be safely inferred. Consortium roles still authorize management of associated boats, but boat/asset chat membership follows direct boat ownership, shares and membership. Consortium chat follows consortium membership.

## Private conversations

A private conversation uses the existing SHA-256 ID of the sorted user pair. PostgreSQL stores a conversation and two participants independently of connections/memberships. Opening or sending the first message establishes the conversation. Both users can continue after shared membership ends or their connection is removed.

Leave chat sets the caller's `leftAt`. It does not delete messages, attachments, read watermarks or the conversation. Both participants retain history. Sending, liking and preparing new message uploads are disabled until both people participate again. Departed people are excluded from message delivery and unread badges.

The other person can invite them back. Only the invited person can accept or decline; sending an invitation or opening the chat cannot silently rejoin anyone. If both left, either can offer to resume; the other's acceptance resumes both participants in the same conversation. A new leave cancels outstanding invitations from that participant. Invitation status appears in the inbox and chat. Invitations are not messages and do not trigger chat-message pushes.

Lifecycle changes and private message sends share a transaction-level lock so a send cannot bypass a concurrent leave. Automatic Doubloon reward messages only post into an existing conversation whose participants have not left; earning rewards never reopens a chat.

## Trip crew

`TripParticipant` is the authoritative roster and contains only registered accounts. New clients send `crewUserIds`. The trip creator is always retained as a participant. Crew is selected from accepted connections and current co-members; existing trip participants remain available even after those relationships end. Selecting a different registered skipper also includes them in the new trip.

Completion locks the roster and skipper identity. Server synchronization and database triggers prevent removing or adding participants, or reopening a completed trip to bypass the lock. Subsequent trip metadata/log updates can still sync. Completed crew keep trip/chat access after any connection or group membership ends. Crew participation never creates a permanent address-book contact or connection.

Old `CrewMember`, `CrewInvite`, `FriendRequest` and `Trip.crewMemberIds` data are retained for migration and compatibility. Legacy connection invitation URLs still work. The old permanent-roster mutation APIs return 410. Legacy unlinked guest records remain historical data and grant no account access; new crew selections require accounts.

## Contacts

Boat and consortium contacts remain shared address-book records with their existing notes, phone numbers and explicit resource grants. Account linkage and membership are independent: joining no longer creates a contact; removing membership no longer unlinks an existing contact; deleting a contact does not remove membership. Existing entries are preserved, including entries created automatically by previous versions, because they may contain useful edits.

## Migration and verification

Deploy `20260923160000_connections_and_trip_participants` before this application version. It canonicalizes directional friend requests (accepted wins), resolves existing private thread IDs without rewriting message history, and backfills participants from trip creators and linked legacy crew. No deployment or production migration is performed by this change.

The migration's historical hash recovery pairs distinct private-message senders with account identities; allow for this work on large user databases. It retains existing memberships, contacts and legacy guest data rather than guessing which records to delete.

A disposable PostgreSQL integration suite is in `src/server/connections.integration.test.ts`. Its explicit environment gate requires `CONNECTIONS_INTEGRATION=1` and the documented localhost test URL in that file. It verifies legacy backfill, completed-trip preservation, user-only crew, boat invitation scope, private-history retention, removal, leave/reinvite/accept/decline, outsiders, and both participants leaving. The normal Vitest suite tests read-only chat UI, request authorization and delivery boundaries.
