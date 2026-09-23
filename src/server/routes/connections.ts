import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { prisma } from '../db'
import { getSessionUserId } from '../session'
import {
  acceptConnection,
  availablePeople,
  connectionPair,
} from '../connections'
import { acceptEconomyInvite } from '../economy/wallet'
import { sendConnectionInviteEmail } from '../email/ses'
import { canAccess } from '../permissions'

export const connectionsRoutes = new Hono<{ Variables: { userId: string } }>()
connectionsRoutes.onError((error, c) => {
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status)
  if (error instanceof z.ZodError)
    return c.json({ error: 'Invalid connection request' }, 400)
  console.error('[connections]', { name: error.name })
  return c.json({ error: 'Could not update connections' }, 500)
})
connectionsRoutes.get('/invites/:token', async (c) => {
  const invite = await prisma.connectionInvite.findUnique({
    where: { token: c.req.param('token') },
  })
  if (!invite) return c.notFound()
  const inviter = await prisma.user.findUnique({
    where: { id: invite.inviterUserId },
    select: { name: true },
  })
  return c.json({
    inviterName: inviter?.name ?? 'A Logmaster user',
    status: invite.status,
    expired: invite.expiresAt < new Date(),
  })
})
connectionsRoutes.use('*', async (c, next) => {
  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  c.set('userId', userId)
  c.header('Cache-Control', 'private, no-store')
  await next()
})
connectionsRoutes.get('/', async (c) =>
  c.json({ people: await availablePeople(c.get('userId')) }),
)
connectionsRoutes.get('/crew-candidates', async (c) => {
  const userId = c.get('userId')
  const people = (await availablePeople(userId)).filter(
    (p) => p.connectionStatus === 'ACCEPTED' || p.contexts.length,
  )
  const tripId = c.req.query('tripId')
  if (tripId) {
    if (!(await canAccess(userId, 'view', { type: 'trip', id: tripId })))
      return c.notFound()
    const participants = await prisma.tripParticipant.findMany({
      where: { tripId },
      include: { user: { select: { id: true, name: true, image: true } } },
    })
    for (const p of participants)
      if (!people.some((person) => person.id === p.userId))
        people.push({
          ...p.user,
          contexts: [],
          connectionStatus: null,
          incoming: false,
        })
  }
  return c.json({ people })
})
connectionsRoutes.post('/request', async (c) => {
  const userId = c.get('userId')
  const input = z
    .object({
      userId: z.string().min(1).optional(),
      email: z.string().email().optional(),
    })
    .refine((v) => Boolean(v.userId || v.email))
    .parse(await c.req.json())
  const peer = await prisma.user.findFirst({
    where: input.userId
      ? { id: input.userId }
      : { email: { equals: input.email!.trim(), mode: 'insensitive' } },
    select: { id: true },
  })
  if (!peer)
    return c.json(
      {
        error:
          'No account found. Use Invite to connect to invite them by email.',
      },
      404,
    )
  if (peer.id === userId) return c.json({ error: 'Choose another person' }, 400)
  const pair = connectionPair(userId, peer.id)
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(pair)}, 1))`
    const old = await tx.userConnection.findUnique({
      where: { userLowId_userHighId: pair },
    })
    if (old?.status === 'ACCEPTED' || old?.status === 'PENDING') return
    await tx.userConnection.upsert({
      where: { userLowId_userHighId: pair },
      create: { ...pair, requestedByUserId: userId },
      update: { status: 'PENDING', requestedByUserId: userId },
    })
  })
  return c.json({ ok: true })
})
connectionsRoutes.post('/:peerId/:action', async (c) => {
  const userId = c.get('userId')
  const peerId = c.req.param('peerId')
  const action = z
    .enum(['accept', 'decline', 'remove', 'cancel'])
    .parse(c.req.param('action'))
  if (peerId === userId) return c.notFound()
  const pair = connectionPair(userId, peerId)
  const where = {
    ...pair,
    ...(action === 'remove'
      ? { status: 'ACCEPTED' }
      : {
          status: 'PENDING',
          requestedByUserId: action === 'cancel' ? userId : peerId,
        }),
  }
  const result = await prisma.userConnection.updateMany({
    where,
    data: {
      status:
        action === 'accept'
          ? 'ACCEPTED'
          : action === 'decline'
            ? 'DECLINED'
            : 'REMOVED',
    },
  })
  if (!result.count)
    return c.json({ error: 'Connection request no longer available' }, 409)
  return c.json({ ok: true })
})
connectionsRoutes.post('/invite', async (c) => {
  const { email } = z
    .object({ email: z.string().email() })
    .parse(await c.req.json())
  const userId = c.get('userId')
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.email.toLowerCase() === email.toLowerCase())
    return c.json({ error: 'Choose another person' }, 400)
  if (
    (await prisma.connectionInvite.count({
      where: {
        inviterUserId: userId,
        createdAt: { gt: new Date(Date.now() - 3600000) },
      },
    })) >= 20
  )
    return c.json({ error: 'Please wait before sending more invitations' }, 429)
  const invite = await prisma.connectionInvite.create({
    data: {
      inviterUserId: userId,
      inviteeEmail: email.trim().toLowerCase(),
      token: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  })
  const origin = (
    process.env.BETTER_AUTH_URL ?? 'http://localhost:3020'
  ).replace(/\/$/, '')
  await sendConnectionInviteEmail({
    to: invite.inviteeEmail,
    inviterName: user.name,
    url: `${origin}/connections/invite/${invite.token}`,
  })
  return c.json({ ok: true }, 201)
})
connectionsRoutes.post('/invites/:token/accept', async (c) => {
  const userId = c.get('userId')
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  await prisma.$transaction(async (tx) => {
    const invite = await tx.connectionInvite.findUnique({
      where: { token: c.req.param('token') },
    })
    if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date())
      throw new HTTPException(409, {
        message: 'Invitation is no longer available',
      })
    if (
      invite.inviterUserId === userId ||
      user.email.toLowerCase() !== invite.inviteeEmail
    )
      throw new HTTPException(403, {
        message: 'Sign in with the invited email address',
      })
    const claimed = await tx.connectionInvite.updateMany({
      where: { id: invite.id, status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    })
    if (!claimed.count)
      throw new HTTPException(409, { message: 'Invitation already accepted' })
    await acceptConnection(tx, invite.inviterUserId, userId)
    await acceptEconomyInvite(tx, invite, userId)
  })
  return c.json({ ok: true })
})
