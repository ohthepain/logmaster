import { Hono } from 'hono'
import { prisma } from '../db'

const db = prisma as any

function parseDate(value: unknown) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toRoute(data: Record<string, unknown>) {
  const createdAt = parseDate(data.createdAt) ?? new Date()
  const updatedAt = parseDate(data.updatedAt) ?? createdAt
  return {
    id: String(data.id ?? crypto.randomUUID()),
    title: String(data.title ?? 'Route'),
    description: (data.description as string | null | undefined) ?? null,
    boatId: (data.boatId as string | null | undefined) ?? null,
    coverKind:
      data.coverKind === 'photo' || data.coverKind === 'map' ? data.coverKind : null,
    coverPhotoDataUrl:
      (data.coverPhotoDataUrl as string | null | undefined) ?? null,
    source: (data.source as string | null | undefined) ?? null,
    createdAt,
    updatedAt,
    synced: true,
  }
}

function toRouteWaypoint(data: Record<string, unknown>) {
  const createdAt = parseDate(data.createdAt) ?? new Date()
  const updatedAt = parseDate(data.updatedAt) ?? createdAt
  return {
    id: String(data.id ?? crypto.randomUUID()),
    routeId: String(data.routeId),
    sequence: Number(data.sequence ?? 0),
    name: (data.name as string | null | undefined) ?? null,
    description: (data.description as string | null | undefined) ?? null,
    symbol: (data.symbol as string | null | undefined) ?? null,
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    createdAt,
    updatedAt,
    synced: true,
  }
}

function toRouteAnnotation(data: Record<string, unknown>) {
  const createdAt = parseDate(data.createdAt) ?? new Date()
  const updatedAt = parseDate(data.updatedAt) ?? createdAt
  return {
    id: String(data.id ?? crypto.randomUUID()),
    routeId: String(data.routeId),
    waypointId: (data.waypointId as string | null | undefined) ?? null,
    kind: data.kind === 'photo' ? 'photo' : 'comment',
    body: (data.body as string | null | undefined) ?? null,
    createdAt,
    updatedAt,
    synced: true,
    deleted: Boolean(data.deleted),
  }
}

function toRouteMedia(data: Record<string, unknown>) {
  const createdAt = parseDate(data.createdAt) ?? new Date()
  const updatedAt = parseDate(data.updatedAt) ?? createdAt
  return {
    id: String(data.id ?? crypto.randomUUID()),
    annotationId: String(data.annotationId),
    type: data.type === 'attachment' ? 'attachment' : 'photo',
    order: Number(data.order ?? 0),
    localPath: (data.localPath as string | null | undefined) ?? null,
    remoteUrl: (data.remoteUrl as string | null | undefined) ?? null,
    thumbnailUrl: (data.thumbnailUrl as string | null | undefined) ?? null,
    createdAt,
    updatedAt,
    synced: true,
  }
}

export const routesApi = new Hono()

routesApi.get('/bootstrap', async (c) => {
  const [routes, waypoints, annotations, routeMedia, deletedRoutes] =
    await Promise.all([
      db.route.findMany({ orderBy: [{ updatedAt: 'desc' }] }),
      db.routeWaypoint.findMany({ orderBy: [{ routeId: 'asc' }, { sequence: 'asc' }] }),
      db.routeAnnotation.findMany({ orderBy: [{ createdAt: 'asc' }] }),
      db.routeMedia.findMany({ orderBy: [{ createdAt: 'asc' }] }),
      db.deletedRoute.findMany(),
    ])

  return c.json({
    routes,
    waypoints,
    annotations,
    routeMedia,
    deletedRouteIds: deletedRoutes.map((row: { id: string }) => row.id),
  })
})

routesApi.post('/sync', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      routes?: Record<string, unknown>[]
      waypoints?: Record<string, unknown>[]
      annotations?: Record<string, unknown>[]
      routeMedia?: Record<string, unknown>[]
      deletedRouteIds?: string[]
    }

    for (const route of body.routes ?? []) {
      const parsed = toRoute(route)
      await db.route.upsert({
        where: { id: parsed.id },
        create: parsed,
        update: parsed,
      })
    }

    for (const waypoint of body.waypoints ?? []) {
      const parsed = toRouteWaypoint(waypoint)
      await db.routeWaypoint.upsert({
        where: { id: parsed.id },
        create: parsed,
        update: parsed,
      })
    }

    for (const annotation of body.annotations ?? []) {
      const parsed = toRouteAnnotation(annotation)
      if (parsed.deleted) {
        await db.routeAnnotation.updateMany({
          where: { id: parsed.id },
          data: { deleted: true, updatedAt: parsed.updatedAt },
        })
        continue
      }
      await db.routeAnnotation.upsert({
        where: { id: parsed.id },
        create: parsed,
        update: parsed,
      })
    }

    for (const media of body.routeMedia ?? []) {
      const parsed = toRouteMedia(media)
      await db.routeMedia.upsert({
        where: { id: parsed.id },
        create: parsed,
        update: parsed,
      })
    }

    for (const id of body.deletedRouteIds ?? []) {
      await db.deletedRoute.upsert({
        where: { id },
        create: { id },
        update: {},
      })
      await db.route.deleteMany({ where: { id } })
    }

    const [routes, waypoints, annotations, routeMedia, deletedRoutes] =
      await Promise.all([
        db.route.findMany({ orderBy: [{ updatedAt: 'desc' }] }),
        db.routeWaypoint.findMany({ orderBy: [{ routeId: 'asc' }, { sequence: 'asc' }] }),
        db.routeAnnotation.findMany({ orderBy: [{ createdAt: 'asc' }] }),
        db.routeMedia.findMany({ orderBy: [{ createdAt: 'asc' }] }),
        db.deletedRoute.findMany(),
      ])

    return c.json({
      routes,
      waypoints,
      annotations,
      routeMedia,
      deletedRouteIds: deletedRoutes.map((row: { id: string }) => row.id),
    })
  } catch (error) {
    console.error('[routes/sync]', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to sync routes' },
      500,
    )
  }
})
