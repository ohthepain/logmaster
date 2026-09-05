export const ROUTE_COVER_KINDS = ['photo', 'map'] as const
export type RouteCoverKind = (typeof ROUTE_COVER_KINDS)[number]

export const ROUTE_ANNOTATION_KINDS = ['comment', 'photo'] as const
export type RouteAnnotationKind = (typeof ROUTE_ANNOTATION_KINDS)[number]

export const ROUTE_MEDIA_TYPES = ['photo', 'attachment'] as const
export type RouteMediaType = (typeof ROUTE_MEDIA_TYPES)[number]

export type Route = {
  id: string
  title: string
  description?: string | null
  boatId?: string | null
  coverKind?: RouteCoverKind | null
  coverPhotoDataUrl?: string | null
  source?: string | null
  createdAt: string
  updatedAt: string
  synced: boolean
}

export type RouteWaypoint = {
  id: string
  routeId: string
  sequence: number
  name?: string | null
  description?: string | null
  symbol?: string | null
  latitude: number
  longitude: number
  createdAt: string
  updatedAt: string
  synced: boolean
}

export type RouteAnnotation = {
  id: string
  routeId: string
  waypointId?: string | null
  kind: RouteAnnotationKind
  body?: string | null
  createdAt: string
  updatedAt: string
  synced: boolean
  deleted: boolean
}

export type RouteMedia = {
  id: string
  annotationId: string
  type: RouteMediaType
  order: number
  localPath?: string | null
  remoteUrl?: string | null
  thumbnailUrl?: string | null
  createdAt: string
  updatedAt: string
  synced: boolean
}

export type RouteSnapshot = {
  routes: Route[]
  waypoints: RouteWaypoint[]
  annotations: RouteAnnotation[]
  routeMedia: RouteMedia[]
  deletedRouteIds?: string[]
}

export type RouteWithWaypoints = Route & {
  waypoints: RouteWaypoint[]
}
