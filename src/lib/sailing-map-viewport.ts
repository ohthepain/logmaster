import type maplibregl from 'maplibre-gl'
import { DEV_FALLBACK_POSITION, getCurrentPosition } from './logbook-context'
import type { MapLngLat } from './logbook-map-geo'

/** Default zoom when a sailing map first mounts. */
export const SAILING_MAP_INITIAL_ZOOM = 10

/** Small zoom bump on first focus — half a level feels interactive without crowding in. */
export const SAILING_MAP_FOCUS_NUDGE = 0.5

export const SAILING_MAP_FOCUS_ZOOM =
  SAILING_MAP_INITIAL_ZOOM + SAILING_MAP_FOCUS_NUDGE

/** Closer zoom when the user explicitly taps locate. */
export const SAILING_MAP_LOCATE_ZOOM = 13

/** Cap fitBounds so map-cover tracks stay at overview scale. */
export const SAILING_MAP_FIT_MAX_ZOOM = SAILING_MAP_INITIAL_ZOOM

export const SAILING_MAP_EASE_MS = 750

export function centerMapOnPoint(
  map: maplibregl.Map,
  point: MapLngLat,
  zoom = SAILING_MAP_FOCUS_ZOOM,
) {
  map.easeTo({
    center: [point.longitude, point.latitude],
    zoom,
    duration: SAILING_MAP_EASE_MS,
  })
}

/** Center on a point with a light zoom nudge from the current view. */
export function juiceMapFocus(map: maplibregl.Map, point: MapLngLat) {
  map.easeTo({
    center: [point.longitude, point.latitude],
    zoom: map.getZoom() + SAILING_MAP_FOCUS_NUDGE,
    duration: SAILING_MAP_EASE_MS,
  })
}

export async function centerMapOnCurrentLocation(
  map: maplibregl.Map,
  options?: { minZoom?: number },
) {
  const minZoom = options?.minZoom ?? SAILING_MAP_LOCATE_ZOOM
  const gps = await getCurrentPosition({ force: true })
  const latitude = gps.latitude ?? DEV_FALLBACK_POSITION.latitude
  const longitude = gps.longitude ?? DEV_FALLBACK_POSITION.longitude

  map.easeTo({
    center: [longitude, latitude],
    zoom: Math.max(map.getZoom(), minZoom),
    duration: SAILING_MAP_EASE_MS,
  })
}
