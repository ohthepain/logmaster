import { useEffect } from 'react'
import { hasBlockingMapOverlay } from '../lib/native/apple-map-layout'
import { setIosMapTouchCaptureSuspended } from '../lib/native/ios-map-touch-suspend'
import { getNativePlatform } from '../lib/platform'

/** Suspend native map touch capture while any full-screen web overlay is open. */
export function IosBlockingOverlayTouchBridge() {
  useEffect(() => {
    if (getNativePlatform() !== 'ios') return

    let active = false

    const sync = () => {
      const blocking = hasBlockingMapOverlay()
      if (blocking === active) {
        return
      }
      active = blocking
      void setIosMapTouchCaptureSuspended(blocking)
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-blocking-overlay'],
    })

    return () => {
      observer.disconnect()
      if (active) {
        void setIosMapTouchCaptureSuspended(false)
      }
    }
  }, [])

  return null
}
