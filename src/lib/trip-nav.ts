import type { Trip } from '../domain/logbook'

export type HeaderNavSegment = 'trips' | 'live-trip' | 'map'

export function resolveInProgressTrip(trips: Trip[]): Trip | null {
  return trips.find((trip) => trip.status === 'IN_PROGRESS') ?? null
}

export function resolveHeaderNavSegment(
  pathname: string,
  inProgressTripId: string | null,
): HeaderNavSegment | null {
  if (pathname === '/map') {
    return 'map'
  }
  if (inProgressTripId && pathname === `/trips/${inProgressTripId}`) {
    return 'live-trip'
  }
  if (pathname === '/trips' || pathname.startsWith('/trips/')) {
    return 'trips'
  }
  return null
}
