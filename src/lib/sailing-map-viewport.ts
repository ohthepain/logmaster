import type maplibregl from 'maplibre-gl'
import { DEV_FALLBACK_POSITION, getCurrentPosition } from './logbook-context'

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
