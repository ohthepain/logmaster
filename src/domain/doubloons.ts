import type { PositionTrackSample } from './trip-track'

export const WELCOME_DOUBLOONS = 100
export const REFERRAL_LIMIT = 100
export const METRES_PER_NM = 1852

export type UnpaidRange = { tripId: string; startedAt: string; endedAt: string }
export type DoubloonTransactionType =
  | 'welcome_grant'
  | 'purchase'
  | 'trip_charge'
  | 'trip_gift'
  | 'referral_reward'
  | 'refund'
  | 'reversal'
  | 'admin_adjustment'

/** Deliberately conservative: never bridge a logging gap or a GPS teleport. */
export function loggedMetres(a: PositionTrackSample, b: PositionTrackSample) {
  const seconds = (Date.parse(b.time) - Date.parse(a.time)) / 1000
  if (b.breakBefore) return 0
  if (!(seconds > 0 && seconds <= 6 * 60 * 60)) return 0
  if (
    ![a, b].every(
      (p) =>
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude) &&
        Math.abs(p.latitude) <= 90 &&
        Math.abs(p.longitude) <= 180,
    )
  )
    return 0
  const rad = Math.PI / 180
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2
  const metres = 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
  // Anchor movement counts; sub-metre jitter and speeds above 60 knots do not.
  return metres < 1 || metres / seconds > (60 * METRES_PER_NM) / 3600
    ? 0
    : metres
}

export function isUnpaidAt(
  tripId: string,
  time: string | Date,
  ranges: UnpaidRange[],
) {
  const at = new Date(time).getTime()
  return ranges.some(
    (r) =>
      r.tripId === tripId &&
      at > Date.parse(r.startedAt) &&
      at <= Date.parse(r.endedAt),
  )
}

export function referralAmount(spent: number, alreadyRewarded: number) {
  return Math.max(0, Math.min(spent, REFERRAL_LIMIT - alreadyRewarded))
}

export function unlockCost(unpaidMiles: number, balance: number) {
  if (!Number.isSafeInteger(unpaidMiles) || unpaidMiles < 0)
    throw new Error('Invalid unpaid mileage')
  if (balance < unpaidMiles)
    throw new Error(
      `You need ${unpaidMiles - balance} more doubloons to unlock these miles.`,
    )
  return unpaidMiles
}
