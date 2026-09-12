import type { Trip } from '../domain/logbook'

export function resolveInProgressTrip(trips: Trip[]): Trip | null {
  return trips.find((trip) => trip.status === 'IN_PROGRESS') ?? null
}

/** Trip shown in map mode — only an active or planned trip, never a completed replay. */
export function resolveMapModeTrip(trips: Trip[]): Trip | null {
  const inProgress = resolveInProgressTrip(trips)
  if (inProgress) return inProgress

  return trips.find((trip) => trip.status === 'PLANNED') ?? null
}
