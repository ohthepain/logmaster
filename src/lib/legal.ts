/** Public legal pages — stable URLs for app store listings and in-app links. */
export const LEGAL_LAST_UPDATED = 'July 9, 2026'

export const LEGAL_CONTACT_EMAIL = 'privacy@logmaster.live'

export const LEGAL_APP_NAME = 'logmaster'

export const LEGAL_SITE_URL = (
  import.meta.env.VITE_PUBLIC_APP_URL ?? 'https://logmaster.live'
).replace(/\/$/, '')

export function legalCanonical(path: string): string {
  return `${LEGAL_SITE_URL}${path}`
}
