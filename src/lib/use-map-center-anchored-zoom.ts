import type maplibregl from 'maplibre-gl'
import { useEffect, type RefObject } from 'react'

const centerZoomOptions = { around: 'center' as const }

/** Keep wheel/pinch zoom anchored on the map center (for fixed crosshair placement). */
export function useMapCenterAnchoredZoom(
  mapRef: RefObject<maplibregl.Map | null>,
  mapReady: boolean,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return
    const map = mapRef.current
    if (!map || !mapReady) return

    const scrollEnabled = map.scrollZoom.isEnabled()
    const touchZoomEnabled = map.touchZoomRotate.isEnabled()
    const doubleClickEnabled = map.doubleClickZoom.isEnabled()

    if (scrollEnabled) {
      map.scrollZoom.enable(centerZoomOptions)
    }
    if (touchZoomEnabled) {
      map.touchZoomRotate.enable(centerZoomOptions)
    }
    if (doubleClickEnabled) {
      map.doubleClickZoom.disable()
    }

    return () => {
      if (scrollEnabled) {
        map.scrollZoom.enable()
      }
      if (touchZoomEnabled) {
        map.touchZoomRotate.enable()
      }
      if (doubleClickEnabled) {
        map.doubleClickZoom.enable()
      }
    }
  }, [active, mapReady, mapRef])
}
