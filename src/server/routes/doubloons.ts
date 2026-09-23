import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db'
import { getSessionUserId } from '../session'
import { economyTransaction, ensureWallet } from '../economy/wallet'
import {
  closeInvalidGifting,
  setTripGifting,
  unlockTripMiles,
} from '../economy/mileage'
import { METRES_PER_NM } from '../../domain/doubloons'
import { wakeChatWorker } from '../messaging/delivery'

export const doubloonRoutes = new Hono()
doubloonRoutes.use('*', async (c, next) => {
  if (!(await getSessionUserId(c.req.raw.headers)))
    return c.json({ error: 'Unauthorized' }, 401)
  c.header('Cache-Control', 'private, no-store')
  await next()
})

doubloonRoutes.get('/', async (c) => {
  const userId = (await getSessionUserId(c.req.raw.headers))!
  const wallet = await economyTransaction((tx) => ensureWallet(tx, userId))
  const trips = await prisma.trip.findMany({
    where: {
      OR: [{ userId }, { participants: { some: { userId } } }],
    },
    orderBy: { startedAt: 'desc' },
  })
  const summaries = []
  for (const trip of trips) {
    if (!trip.userId) continue
    await economyTransaction((tx) => closeInvalidGifting(tx, trip.id))
    const [unpaidMiles, gift, captainWallet] = await Promise.all([
      prisma.tripMile.count({ where: { tripId: trip.id, paidAt: null } }),
      prisma.tripGifting.findFirst({
        where: { tripId: trip.id, endedAt: null },
      }),
      prisma.doubloonWallet.findUnique({ where: { userId: trip.userId } }),
    ])
    if (!unpaidMiles && trip.status !== 'IN_PROGRESS') continue
    const giver = gift
      ? await prisma.user.findUnique({
          where: { id: gift.userId },
          select: { id: true, name: true },
        })
      : null
    summaries.push({
      id: trip.id,
      title: trip.title || trip.boatName,
      skipperId: trip.userId,
      active: trip.status === 'IN_PROGRESS',
      unpaidMiles,
      giver,
      nextGiftNm:
        (METRES_PER_NM - (captainWallet?.remainderMetres ?? 0)) / METRES_PER_NM,
    })
  }
  const referrals = await prisma.doubloonReferral.findMany({
    where: { inviterId: userId },
    orderBy: { createdAt: 'desc' },
  })
  const names = await prisma.user.findMany({
    where: { id: { in: referrals.map((r) => r.inviteeId) } },
    select: { id: true, name: true },
  })
  return c.json({
    userId,
    balance: wallet.balance,
    trips: summaries,
    referrals: referrals.map((r) => ({
      userId: r.inviteeId,
      name: names.find((n) => n.id === r.inviteeId)?.name ?? 'Sailor',
      credited: r.rewarded,
      limit: 100,
    })),
    purchasesAvailable: false,
  })
})

doubloonRoutes.get('/activity', async (c) => {
  const userId = (await getSessionUserId(c.req.raw.headers))!
  const before = Number(c.req.query('before'))
  const rows = await prisma.doubloonTransaction.findMany({
    where: {
      userId,
      ...(Number.isSafeInteger(before) && before > 0
        ? { sequence: { lt: before } }
        : {}),
    },
    orderBy: { sequence: 'desc' },
    take: 51,
  })
  return c.json({
    transactions: rows.slice(0, 50),
    nextBefore: rows.length > 50 ? rows[49].sequence : null,
  })
})

doubloonRoutes.post('/trips/:tripId/gifting', async (c) => {
  const parsed = z
    .object({ enabled: z.boolean() })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success)
    return c.json({ error: 'Specify whether gifting is enabled' }, 400)
  const userId = (await getSessionUserId(c.req.raw.headers))!
  try {
    await setTripGifting(c.req.param('tripId'), userId, parsed.data.enabled)
    return c.json({ ok: true })
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not change gifting',
      },
      409,
    )
  }
})

doubloonRoutes.post('/trips/:tripId/unlock', async (c) => {
  const parsed = z
    .object({
      expectedMiles: z.number().int().positive(),
      requestId: z.string().uuid(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success)
    return c.json({ error: 'Review the unpaid mileage before unlocking' }, 400)
  const userId = (await getSessionUserId(c.req.raw.headers))!
  try {
    await unlockTripMiles(
      c.req.param('tripId'),
      userId,
      parsed.data.expectedMiles,
      parsed.data.requestId,
    )
    await wakeChatWorker()
    return c.json({ ok: true })
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not unlock miles',
      },
      409,
    )
  }
})
