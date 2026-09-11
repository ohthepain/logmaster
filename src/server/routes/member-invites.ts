import { Hono } from 'hono'
import {
  acceptMemberInvite,
  acceptPendingInvitesForEmail,
  getMemberInvitePreview,
} from '../member-invites'
import { prisma } from '../db'
import { getSessionUserId } from '../session'

const db = prisma as any

export const memberInvitesRoutes = new Hono()

async function requireUser(c: { req: { raw: { headers: Headers } } }) {
  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return null
  return db.user.findUnique({ where: { id: userId } })
}

memberInvitesRoutes.get('/preview/:token', async (c) => {
  const preview = await getMemberInvitePreview(c.req.param('token'))
  if (!preview) return c.json({ error: 'Invite not found' }, 404)
  return c.json({ preview })
})

memberInvitesRoutes.post('/accept', async (c) => {
  const user = await requireUser(c)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = (await c.req.json().catch(() => ({}))) as { token?: string }
  const token = body.token?.trim()
  if (!token) return c.json({ error: 'token is required' }, 400)

  try {
    const result = await acceptMemberInvite({
      token,
      userId: user.id,
      userEmail: user.email,
    })
    return c.json({ ok: true, ...result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to accept invite'
    return c.json({ error: message }, 400)
  }
})

memberInvitesRoutes.post('/accept-pending', async (c) => {
  const user = await requireUser(c)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const accepted = await acceptPendingInvitesForEmail(user.id, user.email)
  return c.json({ accepted })
})
