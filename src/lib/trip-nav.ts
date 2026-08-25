import type { Trip } from '../domain/logbook'

export function resolveInProgressTrip(trips: Trip[]): Trip | null {
  return trips.find((trip) => trip.status === 'IN_PROGRESS') ?? null
}

/** Trip shown in map mode — in progress, else planned, else most recent completed. */
export function resolveMapModeTrip(trips: Trip[]): Trip | null {
  const inProgress = resolveInProgressTrip(trips)
  if (inProgress) return inProgress

  const planned = trips.find((trip) => trip.status === 'PLANNED')
  if (planned) return planned

  const completed = trips.filter((trip) => trip.status === 'COMPLETED')
  if (completed.length === 0) return null

  return [...completed].sort(
    (a, b) =>
      new Date(b.completedAt ?? b.updatedAt).getTime() -
      new Date(a.completedAt ?? a.updatedAt).getTime(),
  )[0]
}
