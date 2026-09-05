import type { Route, RouteWaypoint } from '../domain/route'
import {
  GPX_IMPORT_SOURCE,
  parseGpxRoute,
  type GpxImportFile,
  type GpxWaypoint,
} from './gpx-import'

function makeId() {
  return crypto.randomUUID()
}

function nowIso() {
  return new Date().toISOString()
}

function routeTitle(
  name: string | null,
  waypoints: GpxWaypoint[],
  fileName?: string,
): string {
  if (name?.trim()) return name.trim()
  const firstName = waypoints.find((waypoint) => waypoint.name?.trim())?.name?.trim()
  if (firstName) return firstName
  const fromFile = fileName?.replace(/\.gpx$/i, '').trim()
  if (fromFile) return fromFile
  return 'Imported route'
}

function buildRouteWaypoint(
  routeId: string,
  waypoint: GpxWaypoint,
  sequence: number,
  createdAtOffsetMs: number,
): RouteWaypoint {
  const createdAt = new Date(Date.now() + createdAtOffsetMs).toISOString()
  return {
    id: makeId(),
    routeId,
    sequence,
    name: waypoint.name?.trim() || null,
    description: waypoint.description?.trim() || null,
    symbol: waypoint.symbol?.trim() || null,
    latitude: waypoint.latitude,
    longitude: waypoint.longitude,
    createdAt,
    updatedAt: createdAt,
    synced: false,
  }
}

export type GpxImportedRoute = {
  route: Route
  waypoints: RouteWaypoint[]
}

export function buildRouteFromGpxFile(file: GpxImportFile): GpxImportedRoute {
  const parsed = parseGpxRoute(file.gpxXml)
  const routeId = makeId()
  const now = nowIso()

  const route: Route = {
    id: routeId,
    title: routeTitle(parsed.name, parsed.waypoints, file.fileName),
    description: null,
    boatId: null,
    coverKind: 'map',
    coverPhotoDataUrl: null,
    source: GPX_IMPORT_SOURCE,
    createdAt: now,
    updatedAt: now,
    synced: false,
  }

  const waypoints = parsed.waypoints.map((waypoint, index) =>
    buildRouteWaypoint(routeId, waypoint, index, index),
  )

  return { route, waypoints }
}

export function buildRouteFromGpxFiles(files: GpxImportFile[]): GpxImportedRoute[] {
  if (files.length === 0) {
    throw new Error('No GPX files were provided.')
  }
  return files.map((file) => buildRouteFromGpxFile(file))
}
