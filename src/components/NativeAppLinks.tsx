import { App } from '@capacitor/app'
import type { URLOpenListenerEvent } from '@capacitor/app'
import { useEffect } from 'react'
import { navigateToAppLink } from '../lib/app-link-navigation'
import { isNativePlatform } from '../lib/platform'

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
