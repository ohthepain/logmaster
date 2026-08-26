export const STAGING_HOST = 'staging.logmaster.live'

export function isDevModeAvailable(): boolean {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === STAGING_HOST || host === 'localhost' || host === '127.0.0.1'
}
