/** Hostnames that may open inside the Capacitor WebView via Universal / App Links. */
export const APP_LINK_ALLOWED_HOSTS = new Set([
  'logmaster.live',
  'staging.logmaster.live',
  'localhost',
  '127.0.0.1',
])

/** In-app path + query + hash for an allowed https URL, or null if external / invalid. */
export function resolveAppLinkPath(
  rawUrl: string,
  origin = 'https://logmaster.live',
): string | null {
  let target: URL
  try {
    target = new URL(rawUrl, origin)
  } catch {
    return null
  }
  if (!APP_LINK_ALLOWED_HOSTS.has(target.hostname)) return null
  return `${target.pathname}${target.search}${target.hash}`
}

/**
 * Navigate in-app to an absolute or relative URL on an allowed host.
 * Used for Universal Links, App Links, and push notification taps.
 */
export function navigateToAppLink(rawUrl: string): void {
  const next = resolveAppLinkPath(rawUrl, window.location.origin)
  if (!next) return
  if (
    `${window.location.pathname}${window.location.search}${window.location.hash}` ===
    next
  ) {
    return
  }
  window.location.href = next
}
