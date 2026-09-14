const AUTH_REQUIRED_PREFIXES = [
  '/boats',
  '/orgs',
  '/crew',
  '/settings',
  '/admin',
] as const

const AUTH_EXEMPT_PREFIXES = ['/crew/invite/'] as const

export function safeReturnPath(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '/'
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/'
  try {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost'
    const url = new URL(trimmed, origin)
    if (typeof window !== 'undefined' && url.origin !== window.location.origin) {
      return '/'
    }
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}

function normalizeSearch(search: string): string {
  if (!search) return ''
  return search.startsWith('?') ? search : `?${search}`
}

function normalizeHash(hash: string): string {
  if (!hash) return ''
  return hash.startsWith('#') ? hash : `#${hash}`
}

export function currentReturnPath(
  pathname: string,
  search = '',
  hash = '',
): string {
  return safeReturnPath(
    `${pathname}${normalizeSearch(search)}${normalizeHash(hash)}`,
  )
}

export function isAuthRequiredPath(pathname: string): boolean {
  if (AUTH_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false
  }
  return AUTH_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function signInSearch(returnPath: string): { redirect?: string } {
  const redirect = safeReturnPath(returnPath)
  return redirect === '/' ? {} : { redirect }
}

export function signInHref(returnPath: string): string {
  const search = signInSearch(returnPath)
  if (!search.redirect) return '/sign-in'
  return `/sign-in?redirect=${encodeURIComponent(search.redirect)}`
}

export function redirectToSignIn(returnPath?: string) {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/sign-in') return
  const path =
    returnPath ??
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.assign(signInHref(path))
}

export function redirectToSignInIfUnauthorized() {
  if (typeof window === 'undefined') return
  if (!isAuthRequiredPath(window.location.pathname)) return
  redirectToSignIn()
}
