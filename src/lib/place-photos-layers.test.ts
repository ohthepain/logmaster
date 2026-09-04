import { describe, expect, it } from 'vitest'
import {
  mapLayerSupportsPlacePhotos,
  placePhotosPageUrl,
} from './place-photos-layers'

describe('place-photos-layers', () => {
  it('enables photos for places and mooring map layers', () => {
    expect(mapLayerSupportsPlacePhotos('osm-marinas')).toBe(true)
    expect(mapLayerSupportsPlacePhotos('osm-harbours')).toBe(true)
    expect(mapLayerSupportsPlacePhotos('osm-anchorage')).toBe(true)
    expect(mapLayerSupportsPlacePhotos('osm-bay')).toBe(true)
    expect(mapLayerSupportsPlacePhotos('osm-cape')).toBe(true)
    expect(mapLayerSupportsPlacePhotos('osm-island')).toBe(true)
    expect(mapLayerSupportsPlacePhotos('osm-strait')).toBe(true)
    expect(mapLayerSupportsPlacePhotos('geonames-cities')).toBe(true)
  })

  it('does not enable photos for navigation layers', () => {
    expect(mapLayerSupportsPlacePhotos('osm-seamarks-lights')).toBe(false)
    expect(mapLayerSupportsPlacePhotos('osm-depth-soundings')).toBe(false)
  })

  it('builds a place photos page URL with search params', () => {
    expect(
      placePhotosPageUrl({
        latitude: 43.65,
        longitude: -79.38,
        name: 'Toronto Harbour',
        layerId: 'osm-harbours',
      }),
    ).toBe(
      '/places/photos?lat=43.65&lon=-79.38&name=Toronto+Harbour&layer=osm-harbours',
    )
  })
})
