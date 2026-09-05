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
  removePendingRouteIds,
} from '../lib/route-idb'

export type UpdateRouteInput = Partial<
  Pick<Route, 'title' | 'description' | 'coverKind' | 'coverPhotoDataUrl'>
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
  updateRoute: (routeId: string, patch: UpdateRouteInput) => Promise<void>
  importRoutesFromGpxFiles: (files: GpxImportFile[]) => Promise<Route[]>
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
