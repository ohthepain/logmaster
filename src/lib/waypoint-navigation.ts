import type { RouteWaypoint } from '../domain/route'

export type MapLngLat = { latitude: number; longitude: number }

export type OrderedWaypoint = Pick<
  RouteWaypoint,
  'id' | 'sequence' | 'latitude' | 'longitude' | 'name'
>

export function sortWaypointsBySequence<T extends Pick<RouteWaypoint, 'sequence'>>(
  waypoints: T[],
): T[] {
  return [...waypoints].sort((a, b) => a.sequence - b.sequence)
}

function distanceSquared(a: MapLngLat, b: MapLngLat) {
  const dLat = a.latitude - b.latitude
  const dLon = a.longitude - b.longitude
  return dLat * dLat + dLon * dLon
}

/** Project boat position onto polyline; return cumulative fraction along path [0,1]. */
function projectOntoPolyline(
  position: MapLngLat,
  points: MapLngLat[],
): number {
  if (points.length === 0) return 0
  if (points.length === 1) return 0

  let bestDistance = Number.POSITIVE_INFINITY
  let bestFraction = 0
  let traversed = 0
  let totalLength = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    totalLength += Math.sqrt(distanceSquared(points[index]!, points[index + 1]!))
  }
  if (totalLength === 0) return 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!
    const end = points[index + 1]!
    const segmentLength = Math.sqrt(distanceSquared(start, end))
    const t = segmentLength === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((position.longitude - start.longitude) * (end.longitude - start.longitude) +
              (position.latitude - start.latitude) * (end.latitude - start.latitude)) /
              (segmentLength * segmentLength || 1),
          ),
        )
    const projected = {
      latitude: start.latitude + t * (end.latitude - start.latitude),
      longitude: start.longitude + t * (end.longitude - start.longitude),
    }
    const dist = distanceSquared(position, projected)
    if (dist < bestDistance) {
      bestDistance = dist
      bestFraction = (traversed + t * segmentLength) / totalLength
    }
    traversed += segmentLength
  }

  return bestFraction
}

export function resolveActiveWaypointIndex(
  waypoints: OrderedWaypoint[],
  boatPosition: MapLngLat | null,
): number | null {
  const ordered = sortWaypointsBySequence(waypoints)
  if (ordered.length === 0) return null
  if (!boatPosition) return 0

  const points = ordered.map((waypoint) => ({
    latitude: waypoint.latitude,
    longitude: waypoint.longitude,
  }))
  const fraction = projectOntoPolyline(boatPosition, points)
  const passedIndex = Math.floor(fraction * ordered.length)
  const nextIndex = Math.min(passedIndex + 1, ordered.length - 1)

  if (nextIndex === ordered.length - 1 && fraction > 0.98) {
    return null
  }

  return nextIndex
}

export function resolveActiveWaypointId(
  waypoints: OrderedWaypoint[],
  boatPosition: MapLngLat | null,
): string | null {
  const index = resolveActiveWaypointIndex(waypoints, boatPosition)
  if (index == null) return null
  return waypoints[index]?.id ?? null
}
