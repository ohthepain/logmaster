# Doubloons

The trip creator is the skipper in the app. Each completed nautical mile of
logged movement consumes one doubloon, including movement at anchor and under
engine. Wallets receive a single 100-doubloon welcome grant on first use (including
existing accounts adopting the feature). The skipper's fractional distance carries
between trips. Only whole miles are billed.

## Payments

The skipper pays by default. A registered trip participant can volunteer using
the gifting toggle. One giver may be active per trip. Consent is timestamped;
turning it off, leaving crew, ending the trip, or exhausting the giver's wallet
closes it. A gift posts a debit to the crew wallet, a credit to the skipper and a
trip charge to the skipper in one transaction. The net cost is one doubloon.

At zero balance, completed miles become unpaid usage records. Recording and new
trips remain available. Unpaid intervals are omitted from logs, chat log messages,
track payloads, replay, maps and exports. The skipper or selected crew can explicitly
unlock all currently unpaid miles on a trip. The server checks the quoted total
and sufficient funds before debiting. A changing total requires review again.
Credits never settle arrears automatically, and small top-ups unlock nothing.
An active trip may accumulate more unpaid miles after an unlock.

Wallet writes, usage settlement, referrals and gift changes use the same PostgreSQL
transaction advisory lock. This intentionally serializes economy operations for
now. Every balance change has a unique idempotency key, operation ID and per-wallet
sequence. Ledger rows cannot be updated or deleted, enforced by a database trigger.
Audit references survive trip deletion. Reversals/refunds are new transactions;
there is no public arbitrary-credit or balance-edit endpoint.

## Invitations and messages

Referral accounting is independent of connections. Boat and consortium invitations grant only their requested membership. Explicit connection invitations establish a connection on acceptance. The first accepted qualifying invitation
permanently records the inviter. Existing accounts invited to additional groups do
not generate a new referral allowance. Welcome and earned doubloons both qualify
when spent. The original inviter earns one doubloon per doubloon actually spent,
up to 100. Only the actual funder counts: a skipper's pass-through gift debit does
not generate a second reward. Receiving a reward does not recursively reward anyone.

Rewards and an automatic `referral_reward` chat message are committed together.
Delivery uses the existing durable chat outbox. Reward messages only post into an established private conversation while both participants remain in it. Earning a reward never creates or reopens a conversation.

## Recording and visibility

The database migration establishes an activation timestamp: historical samples
before it are never charged retroactively. GPX imports are excluded. Position
samples are processed in timestamp order with a durable per-trip cursor, preventing
retries and overlapping open/sealed chunks from charging twice. Pre-cursor samples
arriving late are not back-billed. A logging restart marks a break; automatic chunk
rollover preserves continuity. Zero/negative timestamps, implausible movement above
60 knots, sub-metre changes, and gaps over six hours are excluded. These conservative
thresholds need validation with real boat recordings. Offshore exemptions are not
implemented: the proposed 100 nm rule needs a coastline-distance source and a final
policy.

Online open tracks sync at most once every 15 seconds. Offline samples are retained
locally and settled on sync; the server is authoritative for balances and visibility.
Cached tracks carry server unpaid intervals so reloading does not reveal confirmed
unpaid samples. Replays and map lines break at hidden intervals rather than connecting
across them. S3 track responses are private/no-store, and redacted caches are refreshed
after unlocking. Do not expose raw database or object-store track URLs in a client.

## Purchases and rollout

App Store products have not yet been created. The account's Buy doubloons control is
explicitly unavailable; there is no simulated checkout. StoreKit purchasing,
server-side verified purchase credits, and App Store refund notifications still need
integration after pack sizes/product IDs are selected. Never credit a wallet from
an unverified client-supplied purchase amount or transaction ID.

Apply `20260923120000_doubloons` before deploying the server/client together.
This change does not deploy or modify an existing database. Existing pre-economy
clients should be retired before a production rollout because they do not understand
local cached-content restrictions. Native offline/background behavior needs a real
device trial before enabling paid sales.

## Verification

- `pnpm typecheck`
- `pnpm exec vitest run --exclude 'ios/**'`
- `pnpm build`
- The opt-in `src/server/economy/economy.integration.test.ts` suite requires an
  isolated PostgreSQL database with migrations applied. It is guarded to run only
  with `ECONOMY_INTEGRATION=1` and the explicit disposable localhost URL in that file.
  Never point financial integration tests at the app database.
