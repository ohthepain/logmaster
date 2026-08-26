import { App } from '@capacitor/app'
import type { URLOpenListenerEvent } from '@capacitor/app'
import { useEffect } from 'react'
import { isNativePlatform } from '../lib/platform'

const ALLOWED_HOSTS = new Set([
  'logmaster.live',
  'staging.logmaster.live',
  'localhost',
  '127.0.0.1',
])

function navigateToAppLink(rawUrl: string) {
  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    return
  }
  if (!ALLOWED_HOSTS.has(target.hostname)) return

  const next = `${target.pathname}${target.search}${target.hash}`
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === next) {
    return
  }
  window.location.href = next.startsWith('/') ? next : target.toString()
}

/** Opens magic-link, password-reset, and other auth URLs inside the native WebView. */
export function NativeAppLinks() {
  useEffect(() => {
    if (!isNativePlatform()) return

    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) navigateToAppLink(launch.url)
    })

    let remove: (() => void) | undefined
    void App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      navigateToAppLink(event.url)
    }).then((handle) => {
      remove = () => handle.remove()
    })

    return () => remove?.()
  }, [])

  return null
}
