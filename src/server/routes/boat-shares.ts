import { Hono } from 'hono'
import { prisma } from '../db'
import {
  addBoatShareOwner,
  loadBoatShares,
  removeBoatShareOwner,
  reorderBoatShares,
  resizeBoatShares,
  updateBoatShareLabel,
} from '../permissions/boat-shares'
import { canAccess } from '../permissions'
import { getSessionUserId } from '../session'
import { fireBoatSharesNotification } from '../notifications/route-hooks'

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

export const boatSharesRoutes = new Hono()

boatSharesRoutes.get('/:boatId/shares', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const allowed = await canAccess(userId, 'view', { type: 'boat', id: boatId })
  if (!allowed) return c.json({ error: 'Boat not found' }, 404)

  const boat = await db.boat.findUnique({
    where: { id: boatId },
    select: { shareCount: true },
  })
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const shares = await loadBoatShares(boatId)
  const canManageShares = await canAccess(userId, 'admin', {
    type: 'boat',
    id: boatId,
  })
  return c.json({ shareCount: boat.shareCount, shares, canManageShares })
})

boatSharesRoutes.patch('/:boatId/shares', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const allowed = await canAccess(userId, 'admin', { type: 'boat', id: boatId })
  if (!allowed) return c.json({ error: 'Boat not found' }, 403)

  const body = (await c.req.json().catch(() => ({}))) as {
    shareCount?: number
    order?: string[]
  }

  try {
    if (body.shareCount !== undefined) {
      await resizeBoatShares(boatId, body.shareCount)
    }
    if (Array.isArray(body.order) && body.order.length > 0) {
      await reorderBoatShares(boatId, body.order)
    }

    const boat = await db.boat.findUnique({
      where: { id: boatId },
      select: { shareCount: true, name: true },
    })
    const shares = await loadBoatShares(boatId)
    if (boat) {
      fireBoatSharesNotification(userId, boat, 'updated share structure.')
    }
    return c.json({ shareCount: boat?.shareCount ?? shares.length, shares })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update shares'
    return c.json({ error: message }, 400)
  }
})

boatSharesRoutes.patch('/:boatId/shares/:shareId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const shareId = c.req.param('shareId')
  const allowed = await canAccess(userId, 'admin', { type: 'boat', id: boatId })
  if (!allowed) return c.json({ error: 'Boat not found' }, 403)

  const body = (await c.req.json().catch(() => ({}))) as {
    label?: string | null
  }
  if (body.label === undefined) {
    return c.json({ error: 'label is required' }, 400)
  }

  const shares = await updateBoatShareLabel(boatId, shareId, body.label)
  if (!shares) return c.json({ error: 'Share not found' }, 404)

  const boat = await db.boat.findUnique({
    where: { id: boatId },
    select: { shareCount: true, name: true },
  })
  if (boat) {
    fireBoatSharesNotification(userId, boat, 'updated a share label.')
  }
  return c.json({ shareCount: boat?.shareCount ?? shares.length, shares })
})

boatSharesRoutes.post('/:boatId/shares/:shareId/owners', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const shareId = c.req.param('shareId')
  const allowed = await canAccess(userId, 'admin', { type: 'boat', id: boatId })
  if (!allowed) return c.json({ error: 'Boat not found' }, 403)

  const boat = await db.boat.findUnique({
    where: { id: boatId },
    select: { consortiumId: true },
  })
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    userId?: string
    email?: string
  }

  let targetUserId = body.userId?.trim()
  if (!targetUserId && body.email?.trim()) {
    const user = await db.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
      select: { id: true },
    })
    if (!user) return c.json({ error: 'No user found with that email' }, 404)
    targetUserId = user.id
  }
  if (!targetUserId) {
    return c.json({ error: 'userId or email is required' }, 400)
  }

  const result = await addBoatShareOwner(
    boatId,
    shareId,
    targetUserId,
    boat.consortiumId,
  )
  if (!result.ok) return c.json({ error: result.error }, 409)

  const updatedBoat = await db.boat.findUnique({
    where: { id: boatId },
    select: { shareCount: true, name: true },
  })
  if (updatedBoat) {
    fireBoatSharesNotification(userId, updatedBoat, 'assigned a share owner.')
  }
  return c.json({
    shareCount: updatedBoat?.shareCount ?? result.shares.length,
    shares: result.shares,
  })
})

boatSharesRoutes.delete(
  '/:boatId/shares/:shareId/owners/:ownerUserId',
  async (c) => {
    const userId = await requireUserId(c)
    if (!userId) return unauthorized()

    const boatId = c.req.param('boatId')
    const shareId = c.req.param('shareId')
    const ownerUserId = c.req.param('ownerUserId')
    const allowed = await canAccess(userId, 'admin', {
      type: 'boat',
      id: boatId,
    })
    if (!allowed) return c.json({ error: 'Boat not found' }, 403)

    const result = await removeBoatShareOwner(boatId, shareId, ownerUserId)
    if (!result.ok) return c.json({ error: result.error }, 404)

    const boat = await db.boat.findUnique({
      where: { id: boatId },
      select: { shareCount: true, name: true },
    })
    if (boat) {
      fireBoatSharesNotification(userId, boat, 'removed a share owner.')
    }
    return c.json({
      shareCount: boat?.shareCount ?? result.shares.length,
      shares: result.shares,
    })
  },
)
