import { describe, expect, it } from 'vitest'
import {
  parseProductNetworkConnections,
  productNetworkConnectionReason,
  productNetworkLabel,
} from './product-networks'

describe('parseProductNetworkConnections', () => {
  it('keeps SeaTalkNG and a port count from i50-style specs', () => {
    expect(
      parseProductNetworkConnections([
        { name: 'SKU', value: 'E70060' },
        { name: 'Width', value: '110 mm (4.22 in)' },
        {
          name: 'Connections',
          value: '2 x SeaTalkng connections; Transducer connections',
        },
      ]),
    ).toEqual([{ networkKey: 'seatal_kng', portCount: 2 }])
  })

  it('does not treat SeaTalkNG as SeaTalk1', () => {
    expect(
      parseProductNetworkConnections([
        { name: 'Connections', value: 'SeaTalkng and transducer' },
      ]),
    ).toEqual([{ networkKey: 'seatal_kng', portCount: null }])
  })

  it('maps NMEA 2000 and Ethernet aliases', () => {
    expect(
      parseProductNetworkConnections([
        { name: 'Network', value: 'NMEA2000, RayNet, N2K backbone' },
      ]),
    ).toEqual([
      { networkKey: 'nmea_2000', portCount: null },
      { networkKey: 'ethernet', portCount: null },
    ])
  })

  it('keeps SeaTalk1 only when numbered', () => {
    expect(
      parseProductNetworkConnections([
        { name: 'Ports', value: '1 x SeaTalk1, Ethernet' },
      ]),
    ).toEqual([
      { networkKey: 'seatal_k1', portCount: 1 },
      { networkKey: 'ethernet', portCount: null },
    ])
  })

  it('ignores unknown connection types and unions LLM keys', () => {
    expect(
      parseProductNetworkConnections(
        [{ name: 'Connections', value: 'Wi-Fi, Bluetooth, USB, NMEA 0183' }],
        [
          { networkKey: 'seatal_kng', portCount: 2 },
          { networkKey: 'wifi', portCount: 1 },
        ],
      ),
    ).toEqual([{ networkKey: 'seatal_kng', portCount: 2 }])
  })
})

describe('product network labels', () => {
  it('formats counts for display and suggestion reasons', () => {
    const ports = { networkKey: 'seatal_kng' as const, portCount: 2 }
    expect(productNetworkLabel(ports)).toBe('2 × SeaTalkNG')
    expect(productNetworkConnectionReason(ports)).toBe(
      'Product has 2 × SeaTalkNG connections',
    )
    expect(
      productNetworkConnectionReason({
        networkKey: 'nmea_2000',
        portCount: null,
      }),
    ).toBe('Product has a NMEA 2000 connection')
  })
})
