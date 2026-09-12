import type { Trip } from '../domain/logbook'
import type { PositionTrackSample, TripTrack } from '../domain/trip-track'
import { haversineMeters } from './place-reverse-lookup'
import { tripTrackSamplesForTrip } from './trip-track-playback'

const METERS_PER_NM = 1852

function validDateMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export function tripTrackDistanceMeters(
  tripId: string,
  tracks: TripTrack[],
): number {
  const samples = tripTrackSamplesForTrip(tripId, tracks)
  return distanceFromPositionSamples(samples)
}

export function distanceFromPositionSamples(
  samples: PositionTrackSample[],
): number {
  let total = 0
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    total += haversineMeters(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude,
    )
  }
  return total
}

export function tripDurationMs(
  trip: Pick<Trip, 'status' | 'startedAt' | 'completedAt'>,
  nowMs = Date.now(),
): number | null {
  const startMs = validDateMs(trip.startedAt)
  if (startMs == null) return null

  if (trip.status === 'PLANNED') return null

  const endMs =
    trip.status === 'COMPLETED'
      ? (validDateMs(trip.completedAt) ?? nowMs)
      : nowMs

  if (endMs <= startMs) return null
  return endMs - startMs
}

export function formatTripListDistanceMeters(distanceM: number | null): string {
  if (distanceM == null || !Number.isFinite(distanceM) || distanceM <= 0) {
    return '—'
  }
  const nauticalMiles = distanceM / METERS_PER_NM
  if (nauticalMiles >= 100) return `${Math.round(nauticalMiles)} nm`
  if (nauticalMiles >= 10) return `${Math.round(nauticalMiles)} nm`
  return `${nauticalMiles.toFixed(1)} nm`
}

type CountLabels = { one: string; other: string }

function formatCountLabel(count: number, labels: CountLabels): string {
  return (count === 1 ? labels.one : labels.other).replaceAll(
    '{count}',
    String(count),
  )
}

export function formatTripListDuration(
  durationMs: number | null,
  labels?: { week: CountLabels; day: CountLabels },
): string {
  if (durationMs == null || durationMs <= 0) return '—'

  const totalMinutes = Math.round(durationMs / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days >= 14) {
    const weeks = Math.round(days / 7)
    return formatCountLabel(
      weeks,
      labels?.week ?? {
        one: '{count} week',
        other: '{count} weeks',
      },
    )
  }
  if (days >= 1) {
    return formatCountLabel(
      days,
      labels?.day ?? {
        one: '{count} day',
        other: '{count} days',
      },
    )
  }
  if (hours >= 1) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return `${minutes}m`
}

export function formatTripListEntryCount(
  count: number,
  labels: { one: string; other: string },
): string {
  return (count === 1 ? labels.one : labels.other).replaceAll(
    '{count}',
    String(count),
  )
}

export function tripListLocationKicker(
  trip: Pick<Trip, 'status' | 'startCountry'>,
  labels?: { inProgress?: string; planned?: string },
): string | null {
  const location = trip.startCountry?.trim()
  const inProgress = labels?.inProgress ?? 'In progress'
  const planned = labels?.planned ?? 'Planned'
  if (trip.status === 'IN_PROGRESS') {
    return location ? `${inProgress} · ${location}` : inProgress
  }
  if (trip.status === 'PLANNED') {
    return location ? `${planned} · ${location}` : planned
  }
  return location ?? null
}
