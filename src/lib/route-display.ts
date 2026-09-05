import type { Route, RouteCoverKind, RouteWaypoint } from '../domain/route'
import { haversineMeters } from './place-reverse-lookup'
import { sortRouteWaypoints } from './route-map-geo'

export function resolveRouteCoverKind(
  route: Pick<Route, 'coverKind' | 'coverPhotoDataUrl'>,
): RouteCoverKind | null {
  if (route.coverKind === 'photo' || route.coverKind === 'map') {
    return route.coverKind
  }
  if (route.coverPhotoDataUrl) return 'photo'
  return null
}

export type RouteDetailCoverDisplay = {
  kind: 'photo' | 'map' | 'none'
  photoUrl: string | null
}

export function routeDetailCoverDisplay(
  route: Pick<Route, 'coverKind' | 'coverPhotoDataUrl'>,
): RouteDetailCoverDisplay {
  const coverKind = resolveRouteCoverKind(route)
  if (coverKind === 'map') {
    return { kind: 'map', photoUrl: null }
  }
  if (coverKind === 'photo') {
    return {
      kind: 'photo',
      photoUrl: route.coverPhotoDataUrl ?? null,
    }
  }
  return { kind: 'none', photoUrl: null }
}

export function routeCoverPhotoUrl(
  route: Pick<Route, 'coverKind' | 'coverPhotoDataUrl'>,
): string | null {
  if (route.coverPhotoDataUrl) return route.coverPhotoDataUrl
  return null
}

export function routeListSubtitle(route: Pick<Route, 'description'>): string {
  const description = route.description?.trim()
  if (description) return description
  return 'Planned route'
}

export function formatRouteListWaypointCount(count: number): string {
  return `${count} waypoint${count === 1 ? '' : 's'}`
}

export function formatRouteListDistanceMeters(distanceM: number | null): string {
  if (distanceM == null || !Number.isFinite(distanceM) || distanceM <= 0) {
    return '—'
  }
  const nauticalMiles = distanceM / 1852
  if (nauticalMiles < 0.1) {
    return `${Math.round(distanceM)} m`
  }
  return `${nauticalMiles.toFixed(1)} nm`
}

export function routePlannedDistanceMeters(waypoints: RouteWaypoint[]): number | null {
  const ordered = sortRouteWaypoints(waypoints)
  if (ordered.length < 2) return null

  let total = 0
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!
    const current = ordered[index]!
    total += haversineMeters(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude,
    )
  }
  return total
}

export function formatRouteUpdatedLabel(updatedAt: string): string {
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return 'Updated recently'
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)}`
}
