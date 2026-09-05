import type { RouteWaypoint } from '../domain/route'
import {
  routeMapMarkerImageId,
  routeWaypointIconKind,
  type RouteMapIconKind,
} from './route-map-marker'
import {
  ROUTE_FINISH_WAYPOINT_COLOR,
  ROUTE_START_WAYPOINT_COLOR,
  WAYPOINT_MAP_COLOR,
} from './waypoint-map-style'

export type MapLngLat = { longitude: number; latitude: number }

export function sortRouteWaypoints(waypoints: RouteWaypoint[]): RouteWaypoint[] {
  return [...waypoints].sort((a, b) => a.sequence - b.sequence)
}

export function routeWaypointMarkerColor(kind: RouteMapIconKind): string {
  switch (kind) {
    case 'waypoint-start':
      return ROUTE_START_WAYPOINT_COLOR
    case 'waypoint-finish':
      return ROUTE_FINISH_WAYPOINT_COLOR
    default:
      return WAYPOINT_MAP_COLOR
  }
}

export function buildRouteLineGeoJson(waypoints: RouteWaypoint[]) {
  const ordered = sortRouteWaypoints(waypoints)
  if (ordered.length < 2) {
    return { type: 'FeatureCollection' as const, features: [] }
  }

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: ordered.map(
            (waypoint) => [waypoint.longitude, waypoint.latitude] as [number, number],
          ),
        },
        properties: {
          lineStyle: 'planned',
        },
      },
    ],
  }
}

export function buildRouteWaypointPointsGeoJson(waypoints: RouteWaypoint[]) {
  const ordered = sortRouteWaypoints(waypoints)

  return {
    type: 'FeatureCollection' as const,
    features: ordered.map((waypoint, index) => {
      const kind = routeWaypointIconKind(index, ordered.length)
      const color = routeWaypointMarkerColor(kind)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [waypoint.longitude, waypoint.latitude] as [number, number],
        },
        properties: {
          waypointId: waypoint.id,
          sequence: index + 1,
          name: waypoint.name ?? `Waypoint ${index + 1}`,
          kind,
          color,
          icon: routeMapMarkerImageId(kind, color),
        },
      }
    }),
  }
}

export function routeMapPoints(waypoints: RouteWaypoint[]): MapLngLat[] {
  return sortRouteWaypoints(waypoints).map((waypoint) => ({
    longitude: waypoint.longitude,
    latitude: waypoint.latitude,
  }))
}

export function mapPointsToBounds(points: MapLngLat[]) {
  if (points.length === 0) return null
  let west = points[0]!.longitude
  let east = points[0]!.longitude
  let south = points[0]!.latitude
  let north = points[0]!.latitude
  for (const point of points) {
    west = Math.min(west, point.longitude)
    east = Math.max(east, point.longitude)
    south = Math.min(south, point.latitude)
    north = Math.max(north, point.latitude)
  }
  if (west === east && south === north) return null
  const latMid = (north + south) / 2
  const lonMid = (west + east) / 2
  const minSpan = 0.002
  if (north - south < minSpan) {
    south = latMid - minSpan / 2
    north = latMid + minSpan / 2
  }
  if (east - west < minSpan) {
    west = lonMid - minSpan / 2
    east = lonMid + minSpan / 2
  }
  return [
    [west, south],
    [east, north],
  ] as [[number, number], [number, number]]
}
