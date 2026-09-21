import type { Trip } from '../domain/logbook'

export function resolveInProgressTrip(trips: Trip[]): Trip | null {
  return trips.find((trip) => trip.status === 'IN_PROGRESS') ?? null
}

/** Trip shown in map mode — only an active trip, never a planned or completed one. */
export function resolveMapModeTrip(trips: Trip[]): Trip | null {
  return resolveInProgressTrip(trips)
}
