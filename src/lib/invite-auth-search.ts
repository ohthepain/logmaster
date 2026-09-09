export type InviteSignInSearch = {
  redirect: string
  email?: string
  mode?: 'sign-in' | 'sign-up'
}

export function buildInviteSignInSearch(args: {
  redirect: string
  email?: string | null
  mode?: 'sign-in' | 'sign-up'
}): InviteSignInSearch {
  const search: InviteSignInSearch = { redirect: args.redirect }
  if (args.email) search.email = args.email
  if (args.mode) search.mode = args.mode
  return search
}

export function parseInviteFromRedirect(
  path: string,
): { kind: 'member' | 'crew'; token: string } | null {
  const memberMatch = path.match(/^\/invite\/([^/?#]+)/)
  if (memberMatch) return { kind: 'member', token: memberMatch[1] }
  const crewMatch = path.match(/^\/crew\/invite\/([^/?#]+)/)
  if (crewMatch) return { kind: 'crew', token: crewMatch[1] }
  return null
}

export function normalizeEmailForCompare(email: string): string {
  return email.trim().toLowerCase()
}

export function inviteSignInHref(search: InviteSignInSearch): string {
  const params = new URLSearchParams()
  params.set('redirect', search.redirect)
  if (search.email) params.set('email', search.email)
  if (search.mode) params.set('mode', search.mode)
  return `/sign-in?${params.toString()}`
}
