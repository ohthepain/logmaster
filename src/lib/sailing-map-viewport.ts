import type maplibregl from 'maplibre-gl'
import { DEV_FALLBACK_POSITION, getCurrentPosition } from './logbook-context'
import type { MapLngLat } from './logbook-map-geo'

export function centerMapOnPoint(
  map: maplibregl.Map,
  point: MapLngLat,
  zoom = 14,
) {
  map.easeTo({
    center: [point.longitude, point.latitude],
    zoom,
    duration: 600,
  })
}

export async function centerMapOnCurrentLocation(
  map: maplibregl.Map,
  options?: { minZoom?: number },
) {
  const minZoom = options?.minZoom ?? 14
  const gps = await getCurrentPosition({ force: true })
  const latitude = gps.latitude ?? DEV_FALLBACK_POSITION.latitude
  const longitude = gps.longitude ?? DEV_FALLBACK_POSITION.longitude

  map.easeTo({
    center: [longitude, latitude],
    zoom: Math.max(map.getZoom(), minZoom),
    duration: 600,
  })
}
