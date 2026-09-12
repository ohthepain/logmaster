import { Browser } from '@capacitor/browser'
import { isNativePlatform } from './platform'

/** Normalize user/AI-provided URLs for opening in a browser. */
export function normalizeExternalUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const href = trimmed.includes('://') ? trimmed : `https://${trimmed}`
    const parsed = new URL(href)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed.href
  } catch {
    return null
  }
}

function openWithAnchor(href: string) {
  const link = document.createElement('a')
  link.href = href
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** Opens an https URL in the system browser (WebView popups often show a blank screen). */
export async function openExternalUrl(url: string): Promise<boolean> {
  const href = normalizeExternalUrl(url)
  if (!href) return false

  if (isNativePlatform()) {
    try {
      await Browser.open({ url: href })
      return true
    } catch {
      openWithAnchor(href)
      return true
    }
  }

  const popup = window.open(href, '_blank', 'noopener,noreferrer')
  if (popup) return true
  openWithAnchor(href)
  return true
}
