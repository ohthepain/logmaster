import type { MiddlewareHandler } from 'hono'
import type { ServerEnv } from '../lib/hono-env'
import { getSessionUserId } from '../session'
import { logHttpRequest } from '../lib/server-log'

const SESSION_SKIP_PATHS = new Set(['/health'])

const SESSION_SKIP_PREFIXES = [
  '/map-tiles/',
  '/maptiler-cdn/',
  '/map-style-vector',
  '/openseamap-seamark/',
  '/openseamap-bathymetry/',
  '/geo-features/',
  '/marinas/',
  '/osm-points/',
  '/ais/',
]

function shouldResolveSession(path: string): boolean {
  if (SESSION_SKIP_PATHS.has(path)) return false
  if (path.startsWith('/auth/')) return false
  return !SESSION_SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))
}

function hasLikelySessionCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false
  return (
    cookieHeader.includes('better-auth') ||
    cookieHeader.includes('session_token')
  )
}

export const requestLogMiddleware: MiddlewareHandler<ServerEnv> = async (
  c,
  next,
) => {
  const started = Date.now()
  const incoming = c.req.header('x-request-id')?.trim()
  const requestId =
    incoming && incoming.length > 0 ? incoming : crypto.randomUUID()

  c.set('requestId', requestId)
  c.header('X-Request-Id', requestId)

  let userId: string | null = null
  const path = c.req.path
  if (
    shouldResolveSession(path) &&
    (c.req.method !== 'GET' ||
      hasLikelySessionCookie(c.req.header('cookie')) ||
      c.req.header('authorization'))
  ) {
    userId = await getSessionUserId(c.req.raw.headers)
  }
  c.set('userId', userId)

  await next()

  logHttpRequest({
    requestId,
    userId,
    method: c.req.method,
    path,
    httpStatus: c.res.status,
    durationMs: Date.now() - started,
  })
}
