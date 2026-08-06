import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAP_REGION_ID,
  getMapRegion,
  MAP_REGIONS,
  UK_MAP_BBOX,
} from './map-regions'

describe('map-regions', () => {
  it('defaults to UK for faster local testing', () => {
    expect(DEFAULT_MAP_REGION_ID).toBe('uk')
  })

  it('keeps UK inside Europe', () => {
    const europe = getMapRegion('europe').bbox
    expect(UK_MAP_BBOX.west).toBeGreaterThanOrEqual(europe.west)
    expect(UK_MAP_BBOX.south).toBeGreaterThanOrEqual(europe.south)
    expect(UK_MAP_BBOX.east).toBeLessThanOrEqual(europe.east)
    expect(UK_MAP_BBOX.north).toBeLessThanOrEqual(europe.north)
  })

  it('UK has fewer tiles than Europe', () => {
    const uk = getMapRegion('uk')
    const europe = getMapRegion('europe')
    expect(uk.degreeTileCount).toBeLessThan(europe.degreeTileCount)
  })

  it('defines a layer availability matrix for every region', () => {
    for (const region of MAP_REGIONS) {
      const values = Object.values(region.layers)
      expect(values.length).toBeGreaterThan(0)
      expect(values.some((entry) => entry.available)).toBe(true)
    }
  })
})
