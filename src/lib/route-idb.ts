import type {
  Route,
  RouteAnnotation,
  RouteMedia,
  RouteSnapshot,
  RouteWaypoint,
} from '../domain/route'
import { getLogbookDb } from './logbook-idb'

const PENDING_DELETED_ROUTES_KEY = 'logmaster-pending-route-deletes'
const PENDING_ROUTE_SYNC_KEY = 'logmaster-pending-route-sync'

function readPendingIdList(key: string): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

function writePendingIdList(key: string, ids: string[]) {
  if (typeof localStorage === 'undefined') return
  if (ids.length === 0) {
    localStorage.removeItem(key)
    return
  }
  localStorage.setItem(key, JSON.stringify(ids))
}

export function getPendingDeletedRouteIds(): string[] {
  return readPendingIdList(PENDING_DELETED_ROUTES_KEY)
}

export function addPendingDeletedRouteId(id: string) {
  const ids = new Set(getPendingDeletedRouteIds())
  ids.add(id)
  writePendingIdList(PENDING_DELETED_ROUTES_KEY, [...ids])
}

export function removePendingDeletedRouteIds(ids: string[]) {
  if (ids.length === 0) return
  const remove = new Set(ids)
  writePendingIdList(
    PENDING_DELETED_ROUTES_KEY,
    getPendingDeletedRouteIds().filter((id) => !remove.has(id)),
  )
}

export function getPendingRouteIds(): string[] {
  return readPendingIdList(PENDING_ROUTE_SYNC_KEY)
}

export function addPendingRouteId(id: string) {
  const ids = new Set(getPendingRouteIds())
  ids.add(id)
  writePendingIdList(PENDING_ROUTE_SYNC_KEY, [...ids])
}

export function removePendingRouteIds(ids: string[]) {
  if (ids.length === 0) return
  const remove = new Set(ids)
  writePendingIdList(
    PENDING_ROUTE_SYNC_KEY,
    getPendingRouteIds().filter((id) => !remove.has(id)),
  )
}

export async function loadRouteSnapshot(): Promise<RouteSnapshot> {
  const db = await getLogbookDb()
  const [routes, waypoints, annotations, routeMedia] = await Promise.all([
    db.getAll('routes'),
    db.getAll('routeWaypoints'),
    db.getAll('routeAnnotations'),
    db.getAll('routeMedia'),
  ])
  return { routes, waypoints, annotations, routeMedia }
}

export async function putRoute(route: Route) {
  const db = await getLogbookDb()
  await db.put('routes', route)
}

export async function putRouteWaypoint(waypoint: RouteWaypoint) {
  const db = await getLogbookDb()
  await db.put('routeWaypoints', waypoint)
}

export async function putRouteAnnotation(annotation: RouteAnnotation) {
  const db = await getLogbookDb()
  await db.put('routeAnnotations', annotation)
}

export async function putRouteMedia(item: RouteMedia) {
  const db = await getLogbookDb()
  await db.put('routeMedia', item)
}

export async function deleteRoute(id: string) {
  const db = await getLogbookDb()
  await db.delete('routes', id)
}

export async function deleteRouteWaypoint(id: string) {
  const db = await getLogbookDb()
  await db.delete('routeWaypoints', id)
}

export async function deleteRouteAnnotation(id: string) {
  const db = await getLogbookDb()
  await db.delete('routeAnnotations', id)
}

export async function deleteRouteMedia(id: string) {
  const db = await getLogbookDb()
  await db.delete('routeMedia', id)
}

export async function getUnsyncedRouteSnapshot(): Promise<RouteSnapshot> {
  const db = await getLogbookDb()
  const [routes, waypoints, annotations, routeMedia] = await Promise.all([
    db.getAll('routes'),
    db.getAllFromIndex('routeWaypoints', 'synced'),
    db.getAllFromIndex('routeAnnotations', 'synced'),
    db.getAllFromIndex('routeMedia', 'synced'),
  ])

  return {
    routes: routes.filter((route) => !route.synced),
    waypoints: waypoints.filter((waypoint) => !waypoint.synced),
    annotations: annotations.filter((annotation) => !annotation.synced),
    routeMedia: routeMedia.filter((item) => !item.synced),
  }
}

export async function persistImportedRoute(imported: {
  route: Route
  waypoints: RouteWaypoint[]
}) {
  await putRoute(imported.route)
  await Promise.all(imported.waypoints.map((waypoint) => putRouteWaypoint(waypoint)))
  addPendingRouteId(imported.route.id)
}
