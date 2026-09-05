import type maplibregl from 'maplibre-gl'
import type { MapLngLat } from './logbook-map-geo'

export function readMapCenter(map: maplibregl.Map): MapLngLat {
  const center = map.getCenter()
  return {
    latitude: center.lat,
    longitude: center.lng,
  }
}

export function formatMapCenterLabel(position: MapLngLat) {
  return `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
}
