import type { LogEntry, LogEntryType } from '../domain/logbook'

export function isTripWaypointEntry(data: Record<string, unknown> | null | undefined) {
  return (
    data?.waypoint === true ||
    data?.gpxWaypoint === true ||
    data?.signalkWaypoint === true
  )
}

export type TripWaypointInput = {
  latitude: number
  longitude: number
  name?: string | null
  notes?: string | null
  timestamp?: string
}

export type TripWaypointEntryInput = {
  tripId: string
  type: LogEntryType
  latitude: number
  longitude: number
  timestamp?: string
  notes?: string | null
  data: Record<string, unknown>
}

export function buildTripWaypointEntryInput(
  tripId: string,
  input: TripWaypointInput,
): TripWaypointEntryInput {
  const name = input.name?.trim() || null
  const notes = input.notes?.trim() || null

  return {
    tripId,
    type: 'NOTE',
    latitude: input.latitude,
    longitude: input.longitude,
    timestamp: input.timestamp,
    notes,
    data: {
      waypoint: true,
      source: 'manual',
      ...(name
        ? {
            place: {
              name,
              detail: null,
              kind: 'waypoint',
              source: 'manual',
              distanceM: 0,
            },
          }
        : {}),
    },
  }
}

export function tripWaypointEntries(entries: LogEntry[]): LogEntry[] {
  return entries.filter(
    (entry) => !entry.deleted && isTripWaypointEntry(entry.data),
  )
}
