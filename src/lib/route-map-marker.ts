export const ROUTE_MAP_ICON_KINDS = [
  'waypoint',
  'waypoint-start',
  'waypoint-finish',
] as const

export type RouteMapIconKind = (typeof ROUTE_MAP_ICON_KINDS)[number]

export function routeMapMarkerImageId(kind: RouteMapIconKind, color: string): string {
  const safeColor = color.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return `route-${kind}-${safeColor}`
}

export function routeWaypointIconKind(index: number, total: number): RouteMapIconKind {
  if (total <= 1) return 'waypoint-start'
  if (index === 0) return 'waypoint-start'
  if (index === total - 1) return 'waypoint-finish'
  return 'waypoint'
}

export function isTripWaypointEntry(data: Record<string, unknown> | null | undefined) {
  return data?.gpxWaypoint === true || data?.signalkWaypoint === true
}
