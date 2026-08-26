import { hasBlockingMapOverlay } from './apple-map-layout'
import { LogmasterAppleMap } from './logmaster-apple-map'
import { getNativePlatform } from '../platform'

export const IOS_MAP_TOUCH_SYNC_EVENT = 'logmaster:sync-map-touch'

/** Notify native map chrome to re-read pass-through zones (e.g. tutorial opened). */
export function requestIosMapTouchSync() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(IOS_MAP_TOUCH_SYNC_EVENT))
}

/** Release the native touch-capture layer so full-screen web UI can receive taps. */
export async function setIosMapTouchCaptureSuspended(suspended: boolean) {
  if (getNativePlatform() !== 'ios') return
  try {
    await LogmasterAppleMap.setTouchCaptureSuspended({ suspended })
  } catch {
    // Older native builds without setTouchCaptureSuspended — layout sync still helps.
  }
  requestIosMapTouchSync()
}

export function isIosWebUiBlockingMapTouch() {
  if (typeof document === 'undefined') return false
  return (
    document.documentElement.dataset.ftueActive != null ||
    hasBlockingMapOverlay()
  )
}
