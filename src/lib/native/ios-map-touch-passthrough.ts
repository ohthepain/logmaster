import { useEffect } from 'react'
import { getNativePlatform } from '../platform'

const ROOT_CLASS = 'ios-native-map-touch-root'

/** Let pan/zoom reach the native MapKit view behind the Capacitor WebView. */
export function useIosNativeMapTouchPassthrough(enabled: boolean) {
  useEffect(() => {
    if (!enabled || getNativePlatform() !== 'ios') return

    const html = document.documentElement
    const body = document.body
    html.classList.add(ROOT_CLASS)
    body.classList.add(ROOT_CLASS)

    return () => {
      html.classList.remove(ROOT_CLASS)
      body.classList.remove(ROOT_CLASS)
    }
  }, [enabled])
}
