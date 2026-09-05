import type { LogEntry } from '../domain/logbook'
import type { Route, RouteWaypoint } from '../domain/route'

export function sortWaypointsBySequence(waypoints: RouteWaypoint[]): RouteWaypoint[] {
  return [...waypoints].sort((a, b) => a.sequence - b.sequence)
}

export function resequenceWaypoints(waypoints: RouteWaypoint[]): RouteWaypoint[] {
  return waypoints.map((waypoint, index) => ({
    ...waypoint,
    sequence: index,
  }))
}

export function normalizeWaypointSequences(waypoints: RouteWaypoint[]): RouteWaypoint[] {
  return resequenceWaypoints(sortWaypointsBySequence(waypoints))
}

export function nextWaypointSequence(waypoints: RouteWaypoint[]): number {
  if (waypoints.length === 0) return 0
  return Math.max(...waypoints.map((waypoint) => waypoint.sequence)) + 1
}

export function insertSequenceAfter(
  waypoints: RouteWaypoint[],
  insertAfterSequence?: number | null,
): number {
  const ordered = sortWaypointsBySequence(waypoints)
  if (insertAfterSequence == null || ordered.length === 0) {
    return nextWaypointSequence(ordered)
  }
  const afterIndex = ordered.findIndex(
    (waypoint) => waypoint.sequence === insertAfterSequence,
  )
  if (afterIndex === -1) return nextWaypointSequence(ordered)
  return insertAfterSequence + 1
}

export function applyInsertSequence(
  waypoints: RouteWaypoint[],
  insertSequence: number,
): RouteWaypoint[] {
  const ordered = sortWaypointsBySequence(waypoints)
  const bumped = ordered.map((waypoint) =>
    waypoint.sequence >= insertSequence
      ? { ...waypoint, sequence: waypoint.sequence + 1 }
      : waypoint,
  )
  return normalizeWaypointSequences(bumped)
}

export function buildNewRouteWaypoint(
  routeId: string,
  input: {
    latitude: number
    longitude: number
    name?: string | null
    description?: string | null
    symbol?: string | null
    sequence: number
  },
  now = new Date().toISOString(),
): RouteWaypoint {
  return {
    id: crypto.randomUUID(),
    routeId,
    sequence: input.sequence,
    name: input.name?.trim() || null,
    description: input.description?.trim() || null,
    symbol: input.symbol?.trim() || null,
    latitude: input.latitude,
    longitude: input.longitude,
    createdAt: now,
    updatedAt: now,
    synced: false,
  }
}

export function copyWaypointsToRoute(
  sourceWaypoints: RouteWaypoint[],
  targetRouteId: string,
  startSequence = 0,
  now = new Date().toISOString(),
): RouteWaypoint[] {
  return sortWaypointsBySequence(sourceWaypoints).map((waypoint, index) => ({
    id: crypto.randomUUID(),
    routeId: targetRouteId,
    sequence: startSequence + index,
    name: waypoint.name,
    description: waypoint.description,
    symbol: waypoint.symbol,
    latitude: waypoint.latitude,
    longitude: waypoint.longitude,
    createdAt: now,
    updatedAt: now,
    synced: false,
  }))
}

function waypointCoordinateKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`
}

export function routeWaypointsToTripEntries(
  waypoints: RouteWaypoint[],
  tripId: string,
  options?: {
    existingEntries?: LogEntry[]
    timestamp?: string
    now?: string
  },
): LogEntry[] {
  const existing = options?.existingEntries ?? []
  const seen = new Set(
    existing
      .filter((entry) => entry.latitude != null && entry.longitude != null)
      .map((entry) =>
        waypointCoordinateKey(entry.latitude!, entry.longitude!),
      ),
  )

  const baseTime = options?.timestamp ?? new Date().toISOString()
  const now = options?.now ?? baseTime

  return sortWaypointsBySequence(waypoints).flatMap((waypoint, index) => {
    const key = waypointCoordinateKey(waypoint.latitude, waypoint.longitude)
    if (seen.has(key)) return []
    seen.add(key)

    const name = waypoint.name?.trim() || `Waypoint ${index + 1}`
    const timestamp = new Date(
      Date.parse(baseTime) + index * 1000,
    ).toISOString()

    const entry: LogEntry = {
      id: crypto.randomUUID(),
      tripId,
      legId: null,
      type: 'NOTE',
      timestamp,
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
      accuracy: null,
      heading: null,
      createdBy: 'captain',
      notes: waypoint.description?.trim() || null,
      data: {
        waypoint: true,
        source: 'route-copy',
        routeWaypointId: waypoint.id,
        ...(waypoint.symbol ? { gpxSymbol: waypoint.symbol } : {}),
        place: {
          name,
          detail: null,
          kind: 'waypoint',
          source: 'route',
          distanceM: 0,
        },
      },
      weather: null,
      createdAt: now,
      updatedAt: now,
      synced: false,
      deleted: false,
    }

    return [entry]
  })
}

export function reorderWaypointsByIds(
  waypoints: RouteWaypoint[],
  orderedWaypointIds: string[],
): RouteWaypoint[] {
  const byId = new Map(waypoints.map((waypoint) => [waypoint.id, waypoint]))
  const ordered: RouteWaypoint[] = []

  for (const id of orderedWaypointIds) {
    const waypoint = byId.get(id)
    if (waypoint) ordered.push(waypoint)
  }

  for (const waypoint of sortWaypointsBySequence(waypoints)) {
    if (!ordered.some((item) => item.id === waypoint.id)) {
      ordered.push(waypoint)
    }
  }

  return resequenceWaypoints(ordered)
}
