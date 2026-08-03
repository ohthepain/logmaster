import { auth } from './auth'

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isAdminEmail(email: string): boolean {
  const allowlist = adminEmails()
  if (allowlist.size === 0) return false
  return allowlist.has(email.trim().toLowerCase())
}

export async function getSessionUser(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  return session?.user ?? null
}

export async function isAdminRequest(headers: Headers): Promise<boolean> {
  const user = await getSessionUser(headers)
  if (!user?.email) return false
  return isAdminEmail(user.email)
}

export function forbidden() {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}
