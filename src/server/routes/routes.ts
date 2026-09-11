import { Hono } from 'hono'
import { prisma } from '../db'
import { canAccess, routeAccessFilter } from '../permissions'
import { getSessionUserId } from '../session'

const db = prisma as any

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  return getSessionUserId(c.req.raw.headers)
}

function parseDate(value: unknown) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toRoute(data: Record<string, unknown>, userId?: string | null) {
  const createdAt = parseDate(data.createdAt) ?? new Date()
  const updatedAt = parseDate(data.updatedAt) ?? createdAt
  return {
    id: String(data.id ?? crypto.randomUUID()),
    userId: userId ?? null,
    title: String(data.title ?? 'Route'),
    description: (data.description as string | null | undefined) ?? null,
    boatId: (data.boatId as string | null | undefined) ?? null,
    coverKind:
      data.coverKind === 'photo' || data.coverKind === 'map'
        ? data.coverKind
        : null,
    coverPhotoDataUrl:
      (data.coverPhotoDataUrl as string | null | undefined) ?? null,
    source: (data.source as string | null | undefined) ?? null,
    createdAt,
    updatedAt,
    synced: true,
  }
}

async function prepareRouteForSync(
  userId: string,
  data: Record<string, unknown>,
) {
  const routeId = String(data.id ?? crypto.randomUUID())
  const existing = await db.route.findUnique({ where: { id: routeId } })

  if (existing) {
    const allowed = await canAccess(userId, 'edit', {
      type: 'route',
      id: routeId,
    })
    if (!allowed) {
      throw new Error(`Forbidden: cannot update route ${routeId}`)
    }
    return toRoute(data, existing.userId ?? userId)
  }

  return toRoute(data, userId)
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

async function assertCanEditRoute(
  userId: string,
  routeId: string,
  allowedFromBatch: Set<string>,
) {
  if (allowedFromBatch.has(routeId)) return
  const allowed = await canAccess(userId, 'edit', {
    type: 'route',
    id: routeId,
  })
  if (!allowed) {
    throw new Error(`Forbidden: cannot update route ${routeId}`)
  }
}

export const routesApi = new Hono()

routesApi.get('/bootstrap', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const routeWhere = await routeAccessFilter(userId)
  const routes = await db.route.findMany({
    where: routeWhere,
    orderBy: [{ updatedAt: 'desc' }],
  })
  const routeIds = routes.map((route: { id: string }) => route.id)

  const [waypoints, annotations, routeMedia, deletedRoutes] = await Promise.all(
    [
      routeIds.length > 0
        ? db.routeWaypoint.findMany({
            where: { routeId: { in: routeIds } },
            orderBy: [{ routeId: 'asc' }, { sequence: 'asc' }],
          })
        : [],
      routeIds.length > 0
        ? db.routeAnnotation.findMany({
            where: { routeId: { in: routeIds } },
            orderBy: [{ createdAt: 'asc' }],
          })
        : [],
      routeIds.length > 0
        ? db.routeMedia.findMany({
            where: { annotation: { routeId: { in: routeIds } } },
            orderBy: [{ createdAt: 'asc' }],
          })
        : [],
      db.deletedRoute.findMany(),
    ],
  )

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
    const userId = await requireUserId(c)
    if (!userId) return unauthorized()

    const body = (await c.req.json().catch(() => ({}))) as {
      routes?: Record<string, unknown>[]
      waypoints?: Record<string, unknown>[]
      annotations?: Record<string, unknown>[]
      routeMedia?: Record<string, unknown>[]
      deletedRouteIds?: string[]
    }

    const preparedRoutes = await Promise.all(
      (body.routes ?? []).map((route) => prepareRouteForSync(userId, route)),
    )
    const allowedRouteIds = new Set(preparedRoutes.map((route) => route.id))

    for (const id of body.deletedRouteIds ?? []) {
      const allowed = await canAccess(userId, 'manage', { type: 'route', id })
      if (!allowed) {
        return c.json({ error: `Forbidden: cannot delete route ${id}` }, 403)
      }
    }

    for (const route of preparedRoutes) {
      await db.route.upsert({
        where: { id: route.id },
        create: route,
        update: route,
      })
    }

    for (const waypoint of body.waypoints ?? []) {
      const routeId = String(waypoint.routeId)
      await assertCanEditRoute(userId, routeId, allowedRouteIds)
      const parsed = toRouteWaypoint(waypoint)
      await db.routeWaypoint.upsert({
        where: { id: parsed.id },
        create: parsed,
        update: parsed,
      })
    }

    for (const annotation of body.annotations ?? []) {
      const routeId = String(annotation.routeId)
      await assertCanEditRoute(userId, routeId, allowedRouteIds)
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
      const annotation = await db.routeAnnotation.findUnique({
        where: { id: String(media.annotationId) },
        select: { routeId: true },
      })
      if (!annotation) continue
      await assertCanEditRoute(userId, annotation.routeId, allowedRouteIds)
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

    const routeWhere = await routeAccessFilter(userId)
    const routes = await db.route.findMany({
      where: routeWhere,
      orderBy: [{ updatedAt: 'desc' }],
    })
    const routeIds = routes.map((route: { id: string }) => route.id)

    const [waypoints, annotations, routeMedia, deletedRoutes] =
      await Promise.all([
        routeIds.length > 0
          ? db.routeWaypoint.findMany({
              where: { routeId: { in: routeIds } },
              orderBy: [{ routeId: 'asc' }, { sequence: 'asc' }],
            })
          : [],
        routeIds.length > 0
          ? db.routeAnnotation.findMany({
              where: { routeId: { in: routeIds } },
              orderBy: [{ createdAt: 'asc' }],
            })
          : [],
        routeIds.length > 0
          ? db.routeMedia.findMany({
              where: { annotation: { routeId: { in: routeIds } } },
              orderBy: [{ createdAt: 'asc' }],
            })
          : [],
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
    const message =
      error instanceof Error ? error.message : 'Failed to sync routes'
    const status = message.startsWith('Forbidden') ? 403 : 500
    return c.json({ error: message }, status)
  }
})
