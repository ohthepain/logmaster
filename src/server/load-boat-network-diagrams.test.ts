import { describe, expect, it } from 'vitest'
import {
  devicesOnNetworkFromConnections,
  productImageUrlForEquipment,
} from './load-boat-network-diagrams'

describe('productImageUrlForEquipment', () => {
  it('returns display URL when canonical verified photo exists', () => {
    const url = productImageUrlForEquipment('prod-1', {
      reviewStatus: 'verified',
      canonicalImageId: 'img-1',
      resources: [
        {
          id: 'img-1',
          displayS3Key: 'key',
          reviewStatus: 'verified',
        },
      ],
    })
    expect(url).toBe('/api/products/prod-1/resources/img-1/content?display=1')
  })

  it('returns null when product is rejected', () => {
    expect(
      productImageUrlForEquipment('prod-1', {
        reviewStatus: 'rejected',
        canonicalImageId: 'img-1',
        resources: [],
      }),
    ).toBeNull()
  })
})

describe('devicesOnNetworkFromConnections', () => {
  const equipment = {
    id: 'eq-1',
    name: 'Plotter',
    brand: 'Raymarine',
    modelNumber: 'Axiom',
    productId: null,
    kind: 'equipment' as const,
    product: null,
  }

  it('merges from and to connections and dedupes by asset id', () => {
    const devices = devicesOnNetworkFromConnections(
      [
        {
          id: 'c1',
          connectionType: 'cable',
          toAsset: equipment,
        },
      ],
      [
        {
          id: 'c2',
          connectionType: 'wifi',
          fromAsset: equipment,
        },
      ],
    )
    expect(devices).toHaveLength(1)
    expect(devices[0]?.connectionId).toBe('c1')
    expect(devices[0]?.connectionType).toBe('cable')
  })

  it('sorts devices by name', () => {
    const devices = devicesOnNetworkFromConnections(
      [
        {
          id: 'c1',
          connectionType: 'cable',
          toAsset: { ...equipment, id: 'b', name: 'VHF' },
        },
        {
          id: 'c2',
          connectionType: 'cable',
          toAsset: { ...equipment, id: 'a', name: 'AIS' },
        },
      ],
      [],
    )
    expect(devices.map((d) => d.name)).toEqual(['AIS', 'VHF'])
  })
})
