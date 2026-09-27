import { Hono } from 'hono'
import { readInviteImage } from '../invite-face'

export const inviteMediaRoutes = new Hono()

async function sendImage(token: string, slot: string) {
  try {
    const image = await readInviteImage(token, slot)
    if (!image) return new Response('Not found', { status: 404 })
    if ('redirect' in image) return Response.redirect(image.redirect, 302)
    return new Response(Buffer.from(image.bytes), {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}

inviteMediaRoutes.get('/:token/org', (c) =>
  sendImage(c.req.param('token'), 'org'),
)
inviteMediaRoutes.get('/:token/boats/:boatId', (c) =>
  sendImage(c.req.param('token'), `boats/${c.req.param('boatId')}`),
)
inviteMediaRoutes.get('/:token/people/:userId', (c) =>
  sendImage(c.req.param('token'), `people/${c.req.param('userId')}`),
)
