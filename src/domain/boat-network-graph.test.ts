import { describe, expect, it } from 'vitest'
import {
  directEquipmentOnNetwork,
  possibleEquipmentOnNetwork,
} from './boat-network-graph'
import type { BoatNetworkGraphConnection } from './boat-network-graph'

const n2k = { id: 'n2k', name: 'NMEA 2000', networkKey: 'nmea_2000' as const }
const stng = {
  id: 'stng',
  name: 'SeaTalkNG',
  networkKey: 'seatal_kng' as const,
}

function conn(
  from: { id: string; kind: 'equipment' | 'system_network' },
  to: { id: string; kind: 'equipment' | 'system_network' },
): BoatNetworkGraphConnection {
  return {
    id: `${from.id}-${to.id}`,
    connectionType: 'cable',
    fromAssetId: from.id,
    fromKind: from.kind,
    toAssetId: to.id,
    toKind: to.kind,
  }
}

describe('boat network graph', () => {
  it('lists only direct equipment on a network', () => {
    const connections = [
      conn(
        { id: 'i50', kind: 'equipment' },
        { id: 'stng', kind: 'system_network' },
      ),
      conn(
        { id: 'stng', kind: 'system_network' },
        { id: 'n2k', kind: 'system_network' },
      ),
    ]
    expect([...directEquipmentOnNetwork('n2k', connections).keys()]).toEqual([])
    expect([...directEquipmentOnNetwork('stng', connections).keys()]).toEqual([
      'i50',
    ])
  })

  it('treats i50 as a possible NMEA 2000 device when linked through SeaTalkNG', () => {
    const connections = [
      conn(
        { id: 'i50', kind: 'equipment' },
        { id: 'stng', kind: 'system_network' },
      ),
      conn(
        { id: 'stng', kind: 'system_network' },
        { id: 'n2k', kind: 'system_network' },
      ),
    ]
    const possible = possibleEquipmentOnNetwork({
      targetNetwork: n2k,
      networks: [n2k, stng],
      equipment: [
        {
          id: 'i50',
          name: 'i50 Tridata',
          brand: 'Raymarine',
          modelNumber: 'i50',
          productNetworkKeys: new Set(['seatal_kng', 'nmea_2000']),
        },
      ],
      connections,
    })
    expect(possible).toMatchObject([
      {
        assetId: 'i50',
        via: 'linked_network',
        viaNetworkName: 'SeaTalkNG',
      },
    ])
  })

  it('hides equipment without a connector for the target network', () => {
    const possible = possibleEquipmentOnNetwork({
      targetNetwork: n2k,
      networks: [n2k, stng],
      equipment: [
        {
          id: 'i50',
          name: 'i50 Tridata',
          brand: 'Raymarine',
          modelNumber: 'i50',
          productNetworkKeys: new Set(['seatal_kng']),
        },
        {
          id: 'wind',
          name: 'Wind transmitter',
          brand: 'Raymarine',
          modelNumber: null,
          productNetworkKeys: null,
        },
        {
          id: 'shunt',
          name: 'SmartShunt',
          brand: 'Victron',
          modelNumber: '500A',
          productNetworkKeys: new Set(['nmea_2000']),
        },
      ],
      connections: [
        conn(
          { id: 'i50', kind: 'equipment' },
          { id: 'stng', kind: 'system_network' },
        ),
        conn(
          { id: 'stng', kind: 'system_network' },
          { id: 'n2k', kind: 'system_network' },
        ),
      ],
    })
    expect(possible.map((item) => item.assetId)).toEqual(['shunt'])
  })
})
