import { useEffect, useLayoutEffect } from 'react'
import {
  isIosWebUiBlockingMapTouch,
  requestIosMapTouchSync,
} from './ios-map-touch-suspend'
import { getNativePlatform } from '../platform'

const ROOT_CLASS = 'ios-native-map-touch-root'
export const IOS_NATIVE_MAP_UNDERLAY_ATTR = 'data-ios-native-map-underlay'

/** Keep the WebView clear so the native MapKit view can show through. */
export function applyIosNativeMapDocumentUnderlay() {
  const html = document.documentElement
  const body = document.body
  const previousHtmlBackground = html.style.backgroundColor
  const previousBodyBackground = body.style.backgroundColor
  html.setAttribute(IOS_NATIVE_MAP_UNDERLAY_ATTR, '')
  html.style.backgroundColor = 'transparent'
  body.style.backgroundColor = 'transparent'
  return () => {
    html.removeAttribute(IOS_NATIVE_MAP_UNDERLAY_ATTR)
    html.style.backgroundColor = previousHtmlBackground
    body.style.backgroundColor = previousBodyBackground
  }
}

/** Let pan/zoom reach the native MapKit view behind the Capacitor WebView. */
export function useIosNativeMapTouchPassthrough(enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled || getNativePlatform() !== 'ios') return
    return applyIosNativeMapDocumentUnderlay()
  }, [enabled])

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
