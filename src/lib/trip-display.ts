import type { Trip, TripCoverKind } from '../domain/logbook'

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

export function resolveTripCoverKind(
  trip: Pick<Trip, 'coverKind' | 'coverPhotoDataUrl'>,
): TripCoverKind | null {
  if (trip.coverKind === 'photo' || trip.coverKind === 'map') {
    return trip.coverKind
  }
  if (trip.coverPhotoDataUrl) return 'photo'
  return null
}

export type TripDetailCoverDisplay = {
  kind: 'photo' | 'map' | 'none'
  photoUrl: string | null
}

export function tripDetailCoverDisplay(
  trip: Pick<Trip, 'coverKind' | 'coverPhotoDataUrl' | 'boatPhotoUrl'>,
): TripDetailCoverDisplay {
  const coverKind = resolveTripCoverKind(trip)
  if (coverKind === 'map') {
    return { kind: 'map', photoUrl: null }
  }
  if (coverKind === 'photo') {
    return {
      kind: 'photo',
      photoUrl: trip.coverPhotoDataUrl ?? trip.boatPhotoUrl ?? null,
    }
  }
  return { kind: 'none', photoUrl: null }
}

export function tripCoverPhotoUrl(
  trip: Pick<Trip, 'coverKind' | 'coverPhotoDataUrl' | 'boatPhotoUrl'>,
): string | null {
  const coverKind = resolveTripCoverKind(trip)
  if (coverKind === 'map') return null
  if (coverKind === 'photo') {
    return trip.coverPhotoDataUrl ?? trip.boatPhotoUrl ?? null
  }
  return trip.coverPhotoDataUrl ?? trip.boatPhotoUrl ?? null
}

export function tripHeroTitle(
  trip: Pick<Trip, 'title' | 'boatName' | 'status'>,
): string {
  const name = tripDisplayName(trip)
  return trip.status === 'PLANNED' ? `${name} (PLANNED)` : name
}

export function firstName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return name
  return trimmed.split(/\s+/)[0] ?? trimmed
}

export function formatTripShortDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatTripDateRange(
  trip: Pick<Trip, 'status' | 'createdAt' | 'startedAt' | 'completedAt'>,
): string {
  if (trip.status === 'PLANNED') {
    return formatTripShortDate(trip.createdAt)
  }

  const start = formatTripShortDate(trip.startedAt)
  if (trip.status === 'COMPLETED' && trip.completedAt) {
    return `${start} → ${formatTripShortDate(trip.completedAt)}`
  }

  return start
}

export function formatTripRelativeStatus(
  trip: Pick<Trip, 'status' | 'createdAt' | 'startedAt' | 'completedAt'>,
): string {
  const now = Date.now()

  if (trip.status === 'PLANNED') {
    const plannedStart = new Date(trip.startedAt).getTime()
    if (!Number.isNaN(plannedStart) && plannedStart > now) {
      return formatRelativeFutureDays(plannedStart)
    }
    return 'Ready to start'
  }

  if (trip.status === 'IN_PROGRESS') {
    return formatRelativePastLabel(new Date(trip.startedAt), 'Started')
  }

  if (trip.status === 'COMPLETED' && trip.completedAt) {
    return formatRelativePastLabel(new Date(trip.completedAt), 'Ended')
  }

  return trip.status.replace('_', ' ').toLowerCase()
}

function formatRelativeFutureDays(targetMs: number): string {
  const days = Math.ceil((targetMs - Date.now()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Ready to start'
  if (days === 1) return 'Starts tomorrow'
  return `Starts in ${days} days`
}

function formatRelativePastLabel(date: Date, prefix: string): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return `${prefix} today`
  if (days === 1) return `${prefix} yesterday`
  if (days < 14) return `${prefix} ${days} days ago`
  return `${prefix} ${formatTripShortDate(date.toISOString())}`
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
