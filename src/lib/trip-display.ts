import type { Trip } from '../domain/logbook'

export function tripDisplayName(trip: Pick<Trip, 'title' | 'boatName'>): string {
  const title = trip.title?.trim()
  return title || trip.boatName
}

export function defaultTripTitle(boatName: string, date = new Date()): string {
  const monthYear = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date)
  return `${boatName.trim()} - ${monthYear}`
}

export function tripCoverPhotoUrl(
  trip: Pick<Trip, 'coverPhotoDataUrl' | 'boatPhotoUrl'>,
): string | null {
  return trip.coverPhotoDataUrl ?? trip.boatPhotoUrl ?? null
}

export function defaultBoatIdForNewTrip(
  trips: Trip[],
  boats: Array<{ id: string; name: string }>,
): string | null {
  if (boats.length === 0) return null

  const sorted = [...trips].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  for (const trip of sorted) {
    if (trip.boatId && boats.some((boat) => boat.id === trip.boatId)) {
      return trip.boatId
    }
    const byName = boats.find((boat) => boat.name === trip.boatName)
    if (byName) return byName.id
  }

  return null
}

export function resolveDefaultBoatIdForNewTrip(
  trips: Trip[],
  boats: Array<{ id: string; name: string }>,
  lastTripBoatId?: string | null,
): string | null {
  if (boats.length === 0) return null
  if (
    lastTripBoatId &&
    boats.some((boat) => boat.id === lastTripBoatId)
  ) {
    return lastTripBoatId
  }
  return defaultBoatIdForNewTrip(trips, boats)
}
