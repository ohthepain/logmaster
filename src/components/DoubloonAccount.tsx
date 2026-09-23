import { useCallback, useEffect, useRef, useState } from 'react'
import { Coins, Gift } from 'lucide-react'
import { Modal } from './Modal'
import {
  economyRequest,
  fetchDoubloonAccount,
  fetchDoubloonActivity,
} from '../lib/doubloons-api'
import type {
  DoubloonAccount as Account,
  WalletActivity,
} from '../lib/doubloons-api'
import { useLogbookStore } from '../stores/logbook'

const button =
  'rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-40'
const labels: Record<WalletActivity['type'], string> = {
  welcome_grant: 'Welcome aboard',
  purchase: 'Doubloons purchased',
  trip_charge: 'Sailing miles',
  trip_gift: 'Trip gift',
  referral_reward: 'Invitation gift',
  refund: 'Refund',
  reversal: 'Reversal',
  admin_adjustment: 'Account adjustment',
}

export function DoubloonAccountModal({
  onClose,
  initialTripId,
}: {
  onClose: () => void
  initialTripId?: string
}) {
  const [account, setAccount] = useState<Account | null>(null)
  const [activity, setActivity] = useState<WalletActivity[]>([])
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [giftTripId, setGiftTripId] = useState<string | null>(null)
  const [unlockTripId, setUnlockTripId] = useState(initialTripId ?? null)
  const requestIds = useRef(new Map<string, string>())
  const refresh = useCallback(async () => {
    const nextAccount = await fetchDoubloonAccount()
    const history = await fetchDoubloonActivity()
    setAccount(nextAccount)
    setActivity(history.transactions)
    setNextBefore(history.nextBefore)
    window.dispatchEvent(new Event('doubloons-changed'))
  }, [])
  useEffect(() => {
    let active = true
    const load = () => {
      if (active)
        void refresh().catch((e) => {
          if (active) setError(e.message)
        })
    }
    load()
    const timer = window.setInterval(() => {
      void fetchDoubloonAccount()
        .then((next) => {
          if (active) setAccount(next)
        })
        .catch((e) => {
          if (active) setError(e.message)
        })
    }, 15000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [refresh])
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await work()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again')
    } finally {
      setBusy(false)
    }
  }
  const giftTrip = account?.trips.find((t) => t.id === giftTripId)
  const unlockTrip = account?.trips.find((t) => t.id === unlockTripId)
  return (
    <Modal
      title="Account"
      onClose={() => {
        if (!giftTripId && !unlockTripId) onClose()
      }}
      centered
    >
      <div className="max-h-[72dvh] space-y-6 overflow-y-auto pr-1">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {!account ? (
          <p role="status">Loading your doubloons…</p>
        ) : (
          <>
            <div className="rounded-2xl bg-amber-50 p-5 text-amber-950">
              <div className="flex items-center gap-3">
                <Coins aria-hidden className="size-9 text-amber-600" />
                <span className="text-3xl font-bold">
                  {account.balance.toLocaleString()}
                </span>
                <span>doubloons</span>
              </div>
              <p className="mb-0 text-sm">
                A little gold for your next adventure.
              </p>
            </div>
            <div>
              <button
                className={button}
                disabled
                aria-describedby="purchase-status"
              >
                Buy doubloons
              </button>
              <p
                id="purchase-status"
                className="mt-2 text-sm text-[var(--sea-ink-soft)]"
              >
                Purchases are not available yet. Welcome and invitation
                doubloons are ready to use.
              </p>
            </div>
            <section>
              <h4 className="font-bold">Give doubloons</h4>
              <p className="text-sm text-[var(--sea-ink-soft)]">
                Gift doubloons to your skipper while you sail together.
              </p>
              {account.trips
                .filter((t) => t.active && t.skipperId !== account.userId)
                .map((t) => (
                  <button
                    key={t.id}
                    className="my-2 flex w-full items-center justify-between rounded-xl border border-[var(--panel-border)] p-3 text-left"
                    onClick={() => setGiftTripId(t.id)}
                  >
                    <span>
                      {t.title}
                      <small className="block text-[var(--sea-ink-soft)]">
                        {t.giver
                          ? `${t.giver.name} is gifting`
                          : 'Give doubloons'}
                      </small>
                    </span>
                    <Gift aria-hidden className="size-5" />
                  </button>
                ))}
              {!account.trips.some(
                (t) => t.active && t.skipperId !== account.userId,
              ) && (
                <p className="text-sm">
                  Join an active trip as crew to turn on gifting.
                </p>
              )}
            </section>
            {account.trips.some((t) => t.unpaidMiles > 0) && (
              <section>
                <h4 className="font-bold">Unpaid miles</h4>
                <p className="text-sm">
                  Keep sailing. You or any crew member can unlock a trip’s
                  unpaid miles whenever you choose.
                </p>
                {account.trips
                  .filter((t) => t.unpaidMiles > 0)
                  .map((t) => (
                    <button
                      key={t.id}
                      className="my-2 w-full rounded-xl border border-[var(--panel-border)] p-3 text-left"
                      onClick={() => setUnlockTripId(t.id)}
                    >
                      {t.title}
                      <small className="block">
                        {t.unpaidMiles} nautical miles · Unlock for{' '}
                        {t.unpaidMiles} doubloons
                      </small>
                    </button>
                  ))}
              </section>
            )}
            <section>
              <h4 className="font-bold">Invitation gifts</h4>
              <p className="text-sm text-[var(--sea-ink-soft)]">
                Earn up to 100 doubloons for each new sailor you invite, as they
                spend theirs.
              </p>
              {account.referrals.length ? (
                account.referrals.map((r) => (
                  <div key={r.userId} className="my-3">
                    <div className="flex justify-between text-sm">
                      <span>{r.name}</span>
                      <span>
                        {r.credited} / {r.limit}
                      </span>
                    </div>
                    <progress
                      className="h-2 w-full accent-amber-500"
                      max={r.limit}
                      value={r.credited}
                      aria-label={`${r.name}: ${r.credited} of ${r.limit} doubloons`}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm">
                  Your invitation gifts will appear here.
                </p>
              )}
            </section>
            <section>
              <h4 className="font-bold">Activity</h4>
              <ul className="m-0 list-none divide-y divide-[var(--panel-border)] p-0">
                {activity.map((a) => (
                  <li
                    key={a.id}
                    className="flex justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <span>{labels[a.type]}</span>
                      {a.source === 'unlock' && <span> · Unlock</span>}
                      <time
                        className="block text-xs text-[var(--sea-ink-soft)]"
                        dateTime={a.createdAt}
                      >
                        {new Date(a.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <div className="text-right">
                      <strong
                        className={a.amount > 0 ? 'text-emerald-700' : ''}
                      >
                        {a.amount > 0 ? '+' : ''}
                        {a.amount}
                      </strong>
                      <small className="block">
                        Balance {a.resultingBalance}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
              {nextBefore && (
                <button
                  disabled={busy}
                  className={button}
                  onClick={() => {
                    setBusy(true)
                    void fetchDoubloonActivity(nextBefore)
                      .then((more) => {
                        setActivity((old) => [...old, ...more.transactions])
                        setNextBefore(more.nextBefore)
                      })
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false))
                  }}
                >
                  Earlier activity
                </button>
              )}
            </section>
          </>
        )}
      </div>
      {giftTrip && account && (
        <Modal
          title="Gift doubloons"
          layer="overlay"
          centered
          onClose={() => setGiftTripId(null)}
        >
          <p className="mb-3">
            Gift your skipper 1 doubloon for each nautical mile completed on{' '}
            {giftTrip.title}.
          </p>
          <p className="mb-3">
            Your next gift is in{' '}
            <strong>{giftTrip.nextGiftNm.toFixed(2)} nm</strong>.
          </p>
          <p className="text-sm">
            Gifting stops when your balance reaches zero, you leave the crew, or
            the trip ends. Turn it off anytime.
          </p>
          {giftTrip.giver && giftTrip.giver.id !== account.userId ? (
            <p>{giftTrip.giver.name} is currently gifting.</p>
          ) : (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-50 p-4 font-semibold text-amber-950">
              Gifting
              <button
                type="button"
                role="switch"
                aria-label="Gifting"
                aria-checked={giftTrip.giver?.id === account.userId}
                disabled={busy || (!giftTrip.giver && account.balance < 1)}
                onClick={() =>
                  void act(() =>
                    economyRequest(`/trips/${giftTrip.id}/gifting`, {
                      enabled: giftTrip.giver?.id !== account.userId,
                    }),
                  )
                }
                className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-40 ${giftTrip.giver?.id === account.userId ? 'bg-amber-600' : 'bg-stone-300'}`}
              >
                <span
                  aria-hidden
                  className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${giftTrip.giver?.id === account.userId ? 'left-1 translate-x-5' : 'left-1'}`}
                />
              </button>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
      {unlockTrip && account && (
        <Modal
          title="Unlock unpaid miles"
          layer="overlay"
          centered
          onClose={() => setUnlockTripId(null)}
        >
          <p className="mb-3">
            {unlockTrip.unpaidMiles} recorded nautical miles on{' '}
            <strong>{unlockTrip.title}</strong> are waiting to be unlocked for
            everyone on this trip.
          </p>
          <p className="mb-3">
            Your balance: <strong>{account.balance} doubloons</strong>
          </p>
          <p className="mb-3 text-sm">
            All unpaid miles are unlocked together. New doubloons never pay for
            them automatically.
          </p>
          {account.balance < unlockTrip.unpaidMiles && (
            <p>
              You need {unlockTrip.unpaidMiles - account.balance} more
              doubloons. Any crew member can unlock these miles for everyone.
            </p>
          )}
          <button
            className={button}
            disabled={
              busy ||
              account.balance < unlockTrip.unpaidMiles ||
              unlockTrip.unpaidMiles < 1
            }
            onClick={() =>
              void act(async () => {
                const key = `${unlockTrip.id}:${unlockTrip.unpaidMiles}`
                const requestId =
                  requestIds.current.get(key) ?? crypto.randomUUID()
                requestIds.current.set(key, requestId)
                await economyRequest(`/trips/${unlockTrip.id}/unlock`, {
                  expectedMiles: unlockTrip.unpaidMiles,
                  requestId,
                })
                requestIds.current.delete(key)
                await useLogbookStore.getState().syncNow()
                setUnlockTripId(null)
              })
            }
          >
            {busy
              ? 'Unlocking…'
              : `Unlock for ${unlockTrip.unpaidMiles} doubloons`}
          </button>
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
    </Modal>
  )
}
