import { isNativePlatform } from './platform'

const DEFAULT_DEV_ORIGIN = 'http://localhost:3020'

function configuredPublicOrigin() {
  const value = import.meta.env.VITE_PUBLIC_APP_URL?.trim()
  return value ? value.replace(/\/$/, '') : null
}

/** Browser or native API/auth origin — remote HTTPS in Capacitor, else current page origin. */
export function getAppOrigin() {
  if (typeof window === 'undefined') {
    return configuredPublicOrigin() ?? DEFAULT_DEV_ORIGIN
  }

  if (isNativePlatform()) {
    return configuredPublicOrigin() ?? DEFAULT_DEV_ORIGIN
  }

  return window.location.origin
}

export function apiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getAppOrigin()}${normalized}`
}
