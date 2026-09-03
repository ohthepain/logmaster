import type { MapDataLayerId } from './map-data-layers'

export type PlacePhotoSource = 'google' | 'flickr'

const PLACE_PHOTOS_LAYER_IDS = new Set<MapDataLayerId>([
  'geonames-cities',
  'osm-marinas',
  'osm-harbours',
  'osm-anchorage',
  'osm-bay',
  'osm-cape',
  'osm-island',
  'osm-strait',
])

export function mapLayerSupportsPlacePhotos(layerId: MapDataLayerId): boolean {
  return PLACE_PHOTOS_LAYER_IDS.has(layerId)
}

export function placePhotosPageUrl(input: {
  latitude: number
  longitude: number
  name?: string | null
  layerId?: MapDataLayerId
  source?: PlacePhotoSource
}): string {
  const params = new URLSearchParams()
  params.set('lat', String(input.latitude))
  params.set('lon', String(input.longitude))
  if (input.name?.trim()) params.set('name', input.name.trim())
  if (input.layerId) params.set('layer', input.layerId)
  if (input.source === 'flickr') params.set('source', 'flickr')
  return `/places/photos?${params.toString()}`
}
