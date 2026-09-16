import { describe, expect, it } from 'vitest'
import {
  connectedBoatNetworks,
  listedBoatNetworks,
  validateAssetConnection,
} from './asset-connections'

const equipment = (id: string) => ({
  id,
  kind: 'equipment' as const,
  boatId: 'boat',
})

const network = (id: string) => ({
  id,
  kind: 'system_network' as const,
  boatId: 'boat',
})

describe('validateAssetConnection', () => {
  it('allows cable between equipment and a network', () => {
    expect(
      validateAssetConnection('cable', equipment('a'), network('n')),
    ).toBeNull()
  })
  it('rejects wifi to a network', () => {
    expect(
      validateAssetConnection('wifi', equipment('a'), network('n')),
    ).toMatch(/Wi‑Fi/)
  })
  it('allows cable links between boat networks', () => {
    expect(
      validateAssetConnection('cable', network('n1'), network('n2')),
    ).toBeNull()
  })
  it('rejects wifi between boat networks', () => {
    expect(
      validateAssetConnection('wifi', network('n1'), network('n2')),
    ).toMatch(/Boat networks/)
  })
})

describe('connectedBoatNetworks', () => {
  it('dedupes and orders by network key', () => {
    expect(
      connectedBoatNetworks([
        {
          id: 'c1',
          connectionType: 'cable',
          reason: '',
          peer: {
            kind: 'network',
            assetId: 'net-eth',
            name: 'Ethernet',
            networkKey: 'ethernet',
          },
        },
        {
          id: 'c2',
          connectionType: 'wifi',
          reason: '',
          peer: { kind: 'equipment', assetId: 'plotter', name: 'Plotter' },
        },
        {
          id: 'c3',
          connectionType: 'cable',
          reason: '',
          peer: {
            kind: 'network',
            assetId: 'net-n2k',
            name: 'NMEA 2000',
            networkKey: 'nmea_2000',
          },
        },
        {
          id: 'c4',
          connectionType: 'cable',
          reason: '',
          peer: {
            kind: 'network',
            assetId: 'net-n2k',
            name: 'NMEA 2000',
            networkKey: 'nmea_2000',
          },
        },
      ]),
    ).toEqual([
      {
        assetId: 'net-n2k',
        name: 'NMEA 2000',
        networkKey: 'nmea_2000',
      },
      {
        assetId: 'net-eth',
        name: 'Ethernet',
        networkKey: 'ethernet',
      },
    ])
  })
})

describe('listedBoatNetworks', () => {
  it('keeps connected system networks only', () => {
    expect(
      listedBoatNetworks([
        {
          id: 'eq',
          name: 'i70',
          kind: 'equipment',
          networkKey: null,
        },
        {
          id: 'stng',
          name: 'SeaTalkNG',
          kind: 'system_network',
          networkKey: 'seatal_kng',
        },
        {
          id: 'n2k',
          name: 'NMEA 2000',
          kind: 'system_network',
          networkKey: 'nmea_2000',
        },
      ]),
    ).toEqual([
      {
        assetId: 'n2k',
        name: 'NMEA 2000',
        networkKey: 'nmea_2000',
      },
      {
        assetId: 'stng',
        name: 'SeaTalkNG',
        networkKey: 'seatal_kng',
      },
    ])
  })
})
