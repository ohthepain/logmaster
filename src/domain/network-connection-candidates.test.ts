import { describe, expect, it } from 'vitest'
import {
  buildNetworkConnectionCandidates,
  equipmentSupportsBoatNetwork,
  networksShareEquipment,
} from './network-connection-candidates'

describe('network connection candidates', () => {
  it('detects shared equipment between networks', () => {
    expect(networksShareEquipment(new Set(['a']), new Set(['a', 'b']))).toBe(
      true,
    )
    expect(networksShareEquipment(new Set(['a']), new Set(['b']))).toBe(false)
  })

  it('requires a catalog connector for the target network', () => {
    expect(equipmentSupportsBoatNetwork(null, 'nmea_2000')).toBe(false)
    expect(equipmentSupportsBoatNetwork(new Set(), 'nmea_2000')).toBe(false)
    expect(
      equipmentSupportsBoatNetwork(new Set(['ethernet']), 'nmea_2000'),
    ).toBe(false)
    expect(
      equipmentSupportsBoatNetwork(new Set(['nmea_2000']), 'nmea_2000'),
    ).toBe(true)
  })

  it('filters equipment by catalog network and existing links', () => {
    const result = buildNetworkConnectionCandidates({
      targetNetworkId: 'n1',
      targetNetworkKey: 'nmea_2000',
      connectedToTarget: new Set(['gps']),
      allNetworks: [
        {
          id: 'n1',
          name: 'NMEA 2000',
          networkKey: 'nmea_2000',
          equipmentIds: new Set(['gps']),
        },
        {
          id: 'n2',
          name: 'Ethernet',
          networkKey: 'ethernet',
          equipmentIds: new Set(['mfd']),
        },
        {
          id: 'n3',
          name: 'SeaTalkNG',
          networkKey: 'seatal_kng',
          equipmentIds: new Set(['gps']),
        },
      ],
      equipment: [
        {
          id: 'gps',
          name: 'GPS',
          brand: 'Garmin',
          modelNumber: 'GPS',
          productNetworkKeys: new Set(['nmea_2000']),
          networkIds: new Set(['n1', 'n3']),
        },
        {
          id: 'mfd',
          name: 'MFD',
          brand: 'Raymarine',
          modelNumber: 'Axiom',
          productNetworkKeys: new Set(['ethernet', 'nmea_2000']),
          networkIds: new Set(['n2']),
        },
        {
          id: 'vhf',
          name: 'VHF',
          brand: 'Icom',
          modelNumber: '506',
          productNetworkKeys: new Set(['ethernet']),
          networkIds: new Set(),
        },
        {
          id: 'unknown',
          name: 'Unknown',
          brand: null,
          modelNumber: null,
          productNetworkKeys: null,
          networkIds: new Set(),
        },
      ],
    })

    expect(result.otherNetworks.map((item) => item.id)).toEqual(['n2'])
    expect(result.equipment.map((item) => item.id)).toEqual(['mfd'])
  })
})
