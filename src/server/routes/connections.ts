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
import { loadInviteArtwork } from '../invite-face'
import {
  connectionLandingPath,
  postInviteChat,
  rememberInviteLanding,
} from '../invite-outcome'
import { logServerEvent } from '../lib/server-log'
import { sendConnectionInviteEmail } from '../email/ses'
import { normalizeInviteLocale } from '../../lib/invite-locale'
import { inviteeHasAccount } from '../invite-signup'
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
  const artwork = await loadInviteArtwork(c.req.param('token'))
  return c.json({
    inviterName: inviter?.name ?? 'A Logmaster user',
    inviteeEmail: invite.inviteeEmail,
    inviteeHasAccount: await inviteeHasAccount(invite.inviteeEmail),
    status: invite.status,
    expired: invite.expiresAt < new Date() || invite.status !== 'PENDING',
    face: artwork?.face ?? null,
    landingPath: artwork?.landingPath ?? null,
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
      create: {
        ...pair,
        requestedByUserId: userId,
        notifyInviteeOnTripStart: true,
        notifyOnInviterTripStart: true,
      },
      update: {
        status: 'PENDING',
        requestedByUserId: userId,
        notifyInviteeOnTripStart: true,
        notifyOnInviterTripStart: true,
      },
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
  let notifyOnInviterTripStart = true
  if (action === 'accept') {
    const body = z
      .object({ notifyOnInviterTripStart: z.boolean().optional() })
      .parse(await c.req.json().catch(() => ({})))
    notifyOnInviterTripStart = body.notifyOnInviterTripStart ?? true
  }
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
      ...(action === 'accept' ? { notifyOnInviterTripStart } : {}),
    },
  })
  if (!result.count)
    return c.json({ error: 'Connection request no longer available' }, 409)
  return c.json({ ok: true })
})
connectionsRoutes.post('/invite', async (c) => {
  const {
    email,
    notifyInviteeOnTripStart,
    inviteLocale: inviteLocaleRaw,
  } = z
    .object({
      email: z.string().email(),
      notifyInviteeOnTripStart: z.boolean().optional(),
      inviteLocale: z.string().optional(),
    })
    .parse(await c.req.json())
  const inviteLocale = normalizeInviteLocale(inviteLocaleRaw)
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
      inviteLocale,
      token: randomBytes(32).toString('hex'),
      notifyInviteeOnTripStart: notifyInviteeOnTripStart ?? true,
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
    locale: invite.inviteLocale,
  })
  return c.json({ ok: true }, 201)
})
connectionsRoutes.post('/invites/:token/accept', async (c) => {
  const userId = c.get('userId')
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const { notifyOnInviterTripStart } = z
    .object({ notifyOnInviterTripStart: z.boolean().optional() })
    .parse(await c.req.json().catch(() => ({})))
  let resolvedLanding = ''
  let acceptedInviteId = ''
  await prisma.$transaction(async (tx) => {
    const invite = await tx.connectionInvite.findUnique({
      where: { token: c.req.param('token') },
    })
    if (!invite)
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
    resolvedLanding = connectionLandingPath(invite.inviterUserId, userId)
    if (invite.status === 'ACCEPTED') return
    if (invite.status !== 'PENDING' || invite.expiresAt < new Date())
      throw new HTTPException(409, {
        message: 'Invitation is no longer available',
      })
    const claimed = await tx.connectionInvite.updateMany({
      where: { id: invite.id, status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    })
    if (!claimed.count) return
    acceptedInviteId = invite.id
    await acceptConnection(tx, invite.inviterUserId, userId, {
      notifyInviteeOnTripStart: invite.notifyInviteeOnTripStart,
      notifyOnInviterTripStart: notifyOnInviterTripStart ?? true,
    })
    const referralCreated = await acceptEconomyInvite(tx, invite, userId)
    const inviter = await tx.user.findUniqueOrThrow({
      where: { id: invite.inviterUserId },
      select: { name: true },
    })
    await postInviteChat(tx, {
      inviterId: invite.inviterUserId,
      inviteeId: userId,
      inviterName: inviter.name,
      inviteeName: user.name,
      connected: true,
      referralCreated,
    })
  })
  if (!resolvedLanding)
    throw new HTTPException(409, {
      message: 'Invitation is no longer available',
    })
  await rememberInviteLanding(userId, resolvedLanding)
  if (acceptedInviteId) {
    logServerEvent({
      action: 'invite.accept',
      resourceType: 'connection_invite',
      resourceId: acceptedInviteId,
      userId,
      outcome: 'success',
    })
  }
  return c.json({ ok: true, landingPath: resolvedLanding })
})
