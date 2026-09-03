import { describe, expect, it } from 'vitest'
import { buildAisFeatureCollection } from './ais-vessels'
import {
  getAisVesselsInBbox,
  resetAisVesselCacheForTests,
  upsertAisVessel,
} from './ais-vessel-cache'

describe('ais vessel cache and GeoJSON', () => {
  it('returns vessels inside the requested bounding box', () => {
    resetAisVesselCacheForTests()
    upsertAisVessel({
      mmsi: '111',
      name: 'Near',
      latitude: 50.8,
      longitude: -1.1,
      cog: 90,
      sog: 5,
      heading: 90,
      shipType: 70,
      shipTypeLabel: 'Cargo',
      category: 'cargo',
      callSign: null,
      imo: null,
      destination: null,
      navigationalStatus: 0,
      navigationalStatusLabel: 'Under way using engine',
      lengthMeters: null,
      widthMeters: null,
      updatedAt: new Date().toISOString(),
    })
    upsertAisVessel({
      mmsi: '222',
      name: 'Far',
      latitude: 55,
      longitude: 5,
      cog: null,
      sog: null,
      heading: null,
      shipType: null,
      shipTypeLabel: null,
      category: 'unspecified',
      callSign: null,
      imo: null,
      destination: null,
      navigationalStatus: null,
      navigationalStatusLabel: null,
      lengthMeters: null,
      widthMeters: null,
      updatedAt: new Date().toISOString(),
    })

    const vessels = getAisVesselsInBbox({
      north: 51,
      south: 50,
      east: 0,
      west: -2,
    })
    expect(vessels).toHaveLength(1)
    expect(vessels[0]?.mmsi).toBe('111')

    const collection = buildAisFeatureCollection(vessels)
    expect(collection.features[0]).toEqual(
      expect.objectContaining({
        geometry: {
          type: 'Point',
          coordinates: [-1.1, 50.8],
        },
        properties: expect.objectContaining({
          mmsi: '111',
          name: 'Near',
          category: 'cargo',
        }),
      }),
    )
  })

  it('preserves ship type when later position reports arrive', () => {
    resetAisVesselCacheForTests()
    upsertAisVessel({
      mmsi: '999',
      name: 'Typed Vessel',
      latitude: 57.5,
      longitude: 18.5,
      shipType: 80,
      shipTypeLabel: 'Tanker',
      category: 'tanker',
      updatedAt: new Date().toISOString(),
    })
    upsertAisVessel({
      mmsi: '999',
      latitude: 57.51,
      longitude: 18.51,
      sog: 12,
      updatedAt: new Date().toISOString(),
    })
    expect(getAisVesselsInBbox({ north: 58, south: 57, east: 19, west: 18 })[0]).toEqual(
      expect.objectContaining({
        category: 'tanker',
        shipType: 80,
        sog: 12,
      }),
    )
  })
})
