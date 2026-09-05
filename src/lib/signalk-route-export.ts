import type { Route, RouteWaypoint } from '../domain/route'
import {
  dedupeWaypointExports,
  type SignalKWaypointExport,
} from './signalk-log-entries'
import { sortRouteWaypoints } from './route-map-geo'

function routeWaypointToSignalK(
  waypoint: RouteWaypoint,
  index: number,
): SignalKWaypointExport {
  return {
    name: waypoint.name?.trim() || `Waypoint ${index + 1}`,
    description: waypoint.description?.trim() || null,
    latitude: waypoint.latitude,
    longitude: waypoint.longitude,
    timestamp: waypoint.createdAt,
    symbol: waypoint.symbol?.trim() || null,
  }
}

export function buildRouteSignalKExport(
  route: Route,
  waypoints: RouteWaypoint[],
): string {
  const ordered = sortRouteWaypoints(waypoints)
  if (ordered.length === 0) {
    throw new Error('This route has no waypoints to export.')
  }

  const exportedWaypoints = dedupeWaypointExports(
    ordered.map((waypoint, index) => routeWaypointToSignalK(waypoint, index)),
  )

  return JSON.stringify(
    {
      name: route.title.trim() || 'Route',
      exportedAt: new Date().toISOString(),
      version: 2,
      kind: 'route',
      positionTrack: [],
      logEntries: [],
      waypoints: exportedWaypoints,
      deltas: [],
    },
    null,
    2,
  )
}
