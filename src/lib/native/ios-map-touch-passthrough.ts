import { useEffect } from 'react'
import { isIosWebUiBlockingMapTouch, requestIosMapTouchSync } from './ios-map-touch-suspend'
import { getNativePlatform } from '../platform'

const ROOT_CLASS = 'ios-native-map-touch-root'

/** Let pan/zoom reach the native MapKit view behind the Capacitor WebView. */
export function useIosNativeMapTouchPassthrough(enabled: boolean) {
  useEffect(() => {
    if (!enabled || getNativePlatform() !== 'ios') return

    const html = document.documentElement
    const body = document.body

    const sync = () => {
      if (isIosWebUiBlockingMapTouch()) {
        html.classList.remove(ROOT_CLASS)
        body.classList.remove(ROOT_CLASS)
        return
      }
      html.classList.add(ROOT_CLASS)
      body.classList.add(ROOT_CLASS)
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-ftue-active'],
    })
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('logmaster:sync-map-touch', sync)

    return () => {
      observer.disconnect()
      window.removeEventListener('logmaster:sync-map-touch', sync)
      html.classList.remove(ROOT_CLASS)
      body.classList.remove(ROOT_CLASS)
    }
  }, [enabled])
}

/** Re-export for map components listening to blocking-overlay changes. */
export { requestIosMapTouchSync }
