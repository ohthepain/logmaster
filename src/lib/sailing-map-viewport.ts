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

/** Screen margin when fitting a trip track on first load (each edge). */
export const TRIP_TRACK_FIT_MARGIN_FRACTION = 0.1

/** Allow short trips to zoom in; overview cap stays on {@link SAILING_MAP_FIT_MAX_ZOOM}. */
export const TRIP_TRACK_FIT_MAX_ZOOM = 16

export const SAILING_MAP_EASE_MS = 750

export type ViewportSize = {
  width: number
  height: number
}

export function tripTrackFitPadding(size: ViewportSize) {
  const width = Math.max(size.width, 1)
  const height = Math.max(size.height, 1)
  const horizontal = Math.round(width * TRIP_TRACK_FIT_MARGIN_FRACTION)
  const vertical = Math.round(height * TRIP_TRACK_FIT_MARGIN_FRACTION)
  return {
    top: vertical,
    bottom: vertical,
    left: horizontal,
    right: horizontal,
  }
}

export function fitMapToTripTrack(
  map: maplibregl.Map,
  bounds: [[number, number], [number, number]],
) {
  const container = map.getContainer()
  map.fitBounds(bounds, {
    padding: tripTrackFitPadding({
      width: container.clientWidth,
      height: container.clientHeight,
    }),
    maxZoom: TRIP_TRACK_FIT_MAX_ZOOM,
    duration: SAILING_MAP_EASE_MS,
  })
}

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
