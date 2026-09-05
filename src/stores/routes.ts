import { create } from 'zustand'
import type {
  Route,
  RouteAnnotation,
  RouteMedia,
  RouteWaypoint,
} from '../domain/route'
import { buildRouteFromGpxFiles, type GpxImportedRoute } from '../lib/gpx-route-import'
import {
  GpxImportError,
  partitionGpxImportFiles,
  type GpxImportFile,
} from '../lib/gpx-import'
import {
  addPendingRouteId,
  addPendingDeletedRouteId,
  deleteRoute as deleteRouteFromIdb,
  deleteRouteAnnotation,
  deleteRouteMedia,
  deleteRouteWaypoint,
  loadRouteSnapshot,
  persistImportedRoute,
  putRoute,
  putRouteAnnotation,
  putRouteWaypoint,
  removePendingRouteIds,
} from '../lib/route-idb'
import {
  buildNewRouteWaypoint,
  copyWaypointsToRoute,
  normalizeWaypointSequences,
  reorderWaypointsByIds,
  resequenceWaypoints,
  sortWaypointsBySequence,
} from '../lib/route-waypoint-ops'

export type UpdateRouteInput = Partial<
  Pick<Route, 'title' | 'description' | 'coverKind' | 'coverPhotoDataUrl'>
>

export type CreateRouteInput = {
  title?: string
  description?: string | null
}

export type AddRouteWaypointInput = {
  latitude: number
  longitude: number
  name?: string | null
  description?: string | null
  symbol?: string | null
  insertAfterSequence?: number | null
}

export type UpdateRouteWaypointInput = Partial<
  Pick<RouteWaypoint, 'latitude' | 'longitude' | 'name' | 'description' | 'symbol'>
>

type RoutesState = {
  booted: boolean
  routes: Route[]
  waypoints: RouteWaypoint[]
  annotations: RouteAnnotation[]
  routeMedia: RouteMedia[]
  selectedRouteId: string | null
  autoMapCoverRouteIds: string[]
  load: () => Promise<void>
  selectRoute: (routeId: string | null) => void
  createRoute: (input?: CreateRouteInput) => Promise<Route>
  updateRoute: (routeId: string, patch: UpdateRouteInput) => Promise<void>
  importRoutesFromGpxFiles: (files: GpxImportFile[]) => Promise<Route[]>
  addRouteWaypoint: (
    routeId: string,
    input: AddRouteWaypointInput,
  ) => Promise<RouteWaypoint>
  updateRouteWaypoint: (
    waypointId: string,
    patch: UpdateRouteWaypointInput,
  ) => Promise<RouteWaypoint | null>
  deleteRouteWaypointById: (waypointId: string) => Promise<void>
  reorderRouteWaypoints: (
    routeId: string,
    orderedWaypointIds: string[],
  ) => Promise<RouteWaypoint[]>
  copyWaypointsFromRoute: (
    targetRouteId: string,
    sourceRouteId: string,
  ) => Promise<RouteWaypoint[]>
  addRouteComment: (
    routeId: string,
    body: string,
    waypointId?: string | null,
  ) => Promise<RouteAnnotation>
  deleteRoute: (routeId: string) => Promise<void>
  requestAutoMapCover: (routeId: string) => void
  clearAutoMapCoverRequest: (routeId: string) => void
}

function nowIso() {
  return new Date().toISOString()
}

function sortWaypoints(waypoints: RouteWaypoint[]) {
  return [...waypoints].sort((a, b) => a.sequence - b.sequence)
}

async function touchRouteUpdatedAt(
  routeId: string,
  get: () => RoutesState,
  set: (partial: Partial<RoutesState> | ((state: RoutesState) => Partial<RoutesState>)) => void,
) {
  const now = nowIso()
  const route = get().routes.find((item) => item.id === routeId)
  if (!route) return

  const updatedRoute = { ...route, updatedAt: now, synced: false }
  await putRoute(updatedRoute)
  addPendingRouteId(routeId)
  set((state) => ({
    routes: state.routes.map((item) =>
      item.id === routeId ? updatedRoute : item,
    ),
  }))
}

async function persistRouteWaypoints(
  routeId: string,
  nextWaypoints: RouteWaypoint[],
  get: () => RoutesState,
  set: (partial: Partial<RoutesState> | ((state: RoutesState) => Partial<RoutesState>)) => void,
) {
  await Promise.all(nextWaypoints.map((waypoint) => putRouteWaypoint(waypoint)))
  await touchRouteUpdatedAt(routeId, get, set)
  set((state) => ({
    waypoints: sortWaypoints([
      ...state.waypoints.filter((waypoint) => waypoint.routeId !== routeId),
      ...nextWaypoints,
    ]),
  }))
}

export const useRoutesStore = create<RoutesState>((set, get) => ({
  booted: false,
  routes: [],
  waypoints: [],
  annotations: [],
  routeMedia: [],
  selectedRouteId: null,
  autoMapCoverRouteIds: [],

  load: async () => {
    const snapshot = await loadRouteSnapshot()
    set({
      booted: true,
      routes: snapshot.routes.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
      waypoints: sortWaypoints(snapshot.waypoints),
      annotations: snapshot.annotations.filter((annotation) => !annotation.deleted),
      routeMedia: snapshot.routeMedia,
    })
  },

  selectRoute: (routeId) => {
    set({ selectedRouteId: routeId })
  },

  createRoute: async (input) => {
    const now = nowIso()
    const route: Route = {
      id: crypto.randomUUID(),
      title: input?.title?.trim() || 'Route',
      description: input?.description?.trim() || null,
      boatId: null,
      coverKind: null,
      coverPhotoDataUrl: null,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
      synced: false,
    }

    await putRoute(route)
    addPendingRouteId(route.id)
    set((state) => ({
      routes: [route, ...state.routes].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    }))

    return route
  },

  updateRoute: async (routeId, patch) => {
    const current = get().routes.find((route) => route.id === routeId)
    if (!current) return

    const next: Route = {
      ...current,
      ...patch,
      title:
        patch.title !== undefined ? patch.title.trim() || 'Route' : current.title,
      description:
        patch.description !== undefined
          ? patch.description?.trim() || null
          : current.description ?? null,
      updatedAt: nowIso(),
      synced: false,
    }

    await putRoute(next)
    addPendingRouteId(routeId)
    set((state) => ({
      routes: state.routes.map((route) => (route.id === routeId ? next : route)),
    }))
  },

  importRoutesFromGpxFiles: async (files) => {
    const { routeFiles } = partitionGpxImportFiles(files)
    if (routeFiles.length === 0) return []

    let imported: GpxImportedRoute[]
    try {
      imported = buildRouteFromGpxFiles(routeFiles)
    } catch (error) {
      if (error instanceof GpxImportError) throw error
      throw new GpxImportError(
        error instanceof Error ? error.message : 'Could not import GPX route',
      )
    }

    for (const item of imported) {
      await persistImportedRoute(item)
    }

    set((state) => ({
      routes: [
        ...imported.map((item) => item.route),
        ...state.routes.filter(
          (route) => !imported.some((item) => item.route.id === route.id),
        ),
      ].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
      waypoints: sortWaypoints([
        ...imported.flatMap((item) => item.waypoints),
        ...state.waypoints.filter(
          (waypoint) =>
            !imported.some((item) => item.route.id === waypoint.routeId),
        ),
      ]),
      autoMapCoverRouteIds: [
        ...state.autoMapCoverRouteIds,
        ...imported
          .map((item) => item.route.id)
          .filter((id) => !state.autoMapCoverRouteIds.includes(id)),
      ],
    }))

    return imported.map((item) => item.route)
  },

  addRouteWaypoint: async (routeId, input) => {
    const route = get().routes.find((item) => item.id === routeId)
    if (!route) throw new Error('Route not found')

    const ordered = sortWaypointsBySequence(routeWaypointsForRoute(routeId, get().waypoints))
    let insertIndex = ordered.length
    if (input.insertAfterSequence != null) {
      const afterIndex = ordered.findIndex(
        (waypoint) => waypoint.sequence === input.insertAfterSequence,
      )
      if (afterIndex !== -1) insertIndex = afterIndex + 1
    }

    const now = nowIso()
    const waypoint = buildNewRouteWaypoint(
      routeId,
      {
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.name,
        description: input.description,
        symbol: input.symbol,
        sequence: insertIndex,
      },
      now,
    )

    const nextWaypoints = resequenceWaypoints([
      ...ordered.slice(0, insertIndex),
      waypoint,
      ...ordered.slice(insertIndex),
    ])
    await persistRouteWaypoints(routeId, nextWaypoints, get, set)
    return nextWaypoints.find((item) => item.id === waypoint.id) ?? waypoint
  },

  updateRouteWaypoint: async (waypointId, patch) => {
    const current = get().waypoints.find((waypoint) => waypoint.id === waypointId)
    if (!current) return null

    const now = nowIso()
    const next: RouteWaypoint = {
      ...current,
      latitude: patch.latitude ?? current.latitude,
      longitude: patch.longitude ?? current.longitude,
      name: patch.name !== undefined ? patch.name?.trim() || null : current.name,
      description:
        patch.description !== undefined
          ? patch.description?.trim() || null
          : current.description,
      symbol: patch.symbol !== undefined ? patch.symbol?.trim() || null : current.symbol,
      updatedAt: now,
      synced: false,
    }

    await putRouteWaypoint(next)
    await touchRouteUpdatedAt(current.routeId, get, set)
    set((state) => ({
      waypoints: sortWaypoints(
        state.waypoints.map((waypoint) => (waypoint.id === waypointId ? next : waypoint)),
      ),
    }))

    return next
  },

  deleteRouteWaypointById: async (waypointId) => {
    const current = get().waypoints.find((waypoint) => waypoint.id === waypointId)
    if (!current) return

    await deleteRouteWaypoint(waypointId)
    const siblings = routeWaypointsForRoute(current.routeId, get().waypoints).filter(
      (waypoint) => waypoint.id !== waypointId,
    )
    const nextWaypoints = normalizeWaypointSequences(siblings)
    await persistRouteWaypoints(current.routeId, nextWaypoints, get, set)
  },

  reorderRouteWaypoints: async (routeId, orderedWaypointIds) => {
    const siblings = routeWaypointsForRoute(routeId, get().waypoints)
    const nextWaypoints = reorderWaypointsByIds(siblings, orderedWaypointIds).map(
      (waypoint) => ({ ...waypoint, updatedAt: nowIso(), synced: false }),
    )
    await persistRouteWaypoints(routeId, nextWaypoints, get, set)
    return nextWaypoints
  },

  copyWaypointsFromRoute: async (targetRouteId, sourceRouteId) => {
    if (targetRouteId === sourceRouteId) {
      throw new Error('Cannot copy waypoints from the same route.')
    }

    const targetRoute = get().routes.find((item) => item.id === targetRouteId)
    const sourceWaypoints = routeWaypointsForRoute(sourceRouteId, get().waypoints)
    if (!targetRoute) throw new Error('Route not found')
    if (sourceWaypoints.length === 0) {
      throw new Error('Source route has no waypoints.')
    }

    const existing = routeWaypointsForRoute(targetRouteId, get().waypoints)
    const startSequence =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((waypoint) => waypoint.sequence)) + 1
    const copied = copyWaypointsToRoute(sourceWaypoints, targetRouteId, startSequence)
    const nextWaypoints = sortWaypoints([...existing, ...copied])
    await persistRouteWaypoints(targetRouteId, nextWaypoints, get, set)
    return copied
  },

  addRouteComment: async (routeId, body, waypointId = null) => {
    const trimmed = body.trim()
    if (!trimmed) {
      throw new Error('Comment cannot be empty.')
    }

    const now = new Date().toISOString()
    const annotation: RouteAnnotation = {
      id: crypto.randomUUID(),
      routeId,
      waypointId: waypointId ?? null,
      kind: 'comment',
      body: trimmed,
      createdAt: now,
      updatedAt: now,
      synced: false,
      deleted: false,
    }

    await putRouteAnnotation(annotation)
    addPendingRouteId(routeId)

    const route = get().routes.find((item) => item.id === routeId)
    if (route) {
      const updatedRoute = { ...route, updatedAt: now, synced: false }
      await putRoute(updatedRoute)
    }

    set((state) => ({
      annotations: [...state.annotations, annotation].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
      routes: state.routes.map((item) =>
        item.id === routeId ? { ...item, updatedAt: now, synced: false } : item,
      ),
    }))

    return annotation
  },

  deleteRoute: async (routeId) => {
    const waypoints = get().waypoints.filter((waypoint) => waypoint.routeId === routeId)
    const annotations = get().annotations.filter(
      (annotation) => annotation.routeId === routeId,
    )
    const annotationIds = new Set(annotations.map((annotation) => annotation.id))
    const media = get().routeMedia.filter((item) =>
      annotationIds.has(item.annotationId),
    )

    addPendingDeletedRouteId(routeId)
    removePendingRouteIds([routeId])
    await deleteRouteFromIdb(routeId)
    await Promise.all([
      ...waypoints.map((waypoint) => deleteRouteWaypoint(waypoint.id)),
      ...annotations.map((annotation) => deleteRouteAnnotation(annotation.id)),
      ...media.map((item) => deleteRouteMedia(item.id)),
    ])

    set((state) => ({
      routes: state.routes.filter((route) => route.id !== routeId),
      waypoints: state.waypoints.filter((waypoint) => waypoint.routeId !== routeId),
      annotations: state.annotations.filter(
        (annotation) => annotation.routeId !== routeId,
      ),
      routeMedia: state.routeMedia.filter(
        (item) => !annotationIds.has(item.annotationId),
      ),
      selectedRouteId:
        state.selectedRouteId === routeId ? null : state.selectedRouteId,
      autoMapCoverRouteIds: state.autoMapCoverRouteIds.filter((id) => id !== routeId),
    }))
  },

  requestAutoMapCover: (routeId) => {
    set((state) => ({
      autoMapCoverRouteIds: state.autoMapCoverRouteIds.includes(routeId)
        ? state.autoMapCoverRouteIds
        : [...state.autoMapCoverRouteIds, routeId],
    }))
  },

  clearAutoMapCoverRequest: (routeId) => {
    set((state) => ({
      autoMapCoverRouteIds: state.autoMapCoverRouteIds.filter((id) => id !== routeId),
    }))
  },
}))

export function routeWaypointsForRoute(
  routeId: string,
  waypoints: RouteWaypoint[],
): RouteWaypoint[] {
  return sortWaypoints(waypoints.filter((waypoint) => waypoint.routeId === routeId))
}

export function routeAnnotationsForRoute(
  routeId: string,
  annotations: RouteAnnotation[],
  waypointId?: string | null,
) {
  return annotations.filter((annotation) => {
    if (annotation.routeId !== routeId || annotation.deleted) return false
    if (waypointId === undefined) return true
    return annotation.waypointId === waypointId
  })
}
