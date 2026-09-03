import { afterEach, describe, expect, it } from 'vitest'
import { parseAisStreamMessage } from './parse-aisstream-message'

describe('parseAisStreamMessage', () => {
  afterEach(() => {
    /* no shared state */
  })

  it('ignores subscription confirmations', () => {
    expect(
      parseAisStreamMessage({
        MessageType: 'SubscriptionConfirmation',
        Message: { CompressionEnabled: true },
      }),
    ).toBeNull()
  })

  it('parses position reports from metadata and message payload', () => {
    expect(
      parseAisStreamMessage({
        MessageType: 'PositionReport',
        MetaData: {
          MMSI: 368207620,
          ShipName: 'EXAMPLE VESSEL',
          Latitude: 25.7617,
          Longitude: -80.1918,
        },
        Message: {
          PositionReport: {
            NavigationalStatus: 0,
            Sog: 12.4,
            Cog: 86.7,
            TrueHeading: 87,
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        mmsi: '368207620',
        name: 'EXAMPLE VESSEL',
        latitude: 25.7617,
        longitude: -80.1918,
        sog: 12.4,
        cog: 86.7,
        heading: 87,
        navigationalStatus: 0,
        navigationalStatusLabel: 'Under way using engine',
      }),
    )
  })

  it('parses ship static data with dimensions and type', () => {
    expect(
      parseAisStreamMessage({
        MessageType: 'ShipStaticData',
        MetaData: {
          MMSI: 123456789,
          Latitude: 50.8,
          Longitude: -1.1,
        },
        Message: {
          ShipStaticData: {
            Name: '  STATIC NAME  ',
            Type: 70,
            CallSign: 'GB1234',
            ImoNumber: 9876543,
            Destination: 'SOUTHAMPTON',
            Dimension: { A: 50, B: 30, C: 8, D: 7 },
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        mmsi: '123456789',
        name: 'STATIC NAME',
        latitude: 50.8,
        longitude: -1.1,
        shipType: 70,
        shipTypeLabel: 'Cargo',
        category: 'cargo',
        callSign: 'GB1234',
        imo: '9876543',
        destination: 'SOUTHAMPTON',
        lengthMeters: 80,
        widthMeters: 15,
      }),
    )
  })

  it('allows static-only updates without a fresh position', () => {
    expect(
      parseAisStreamMessage({
        MessageType: 'ShipStaticData',
        MetaData: {
          MMSI: 555666777,
          ShipName: 'STATIC ONLY',
        },
        Message: {
          ShipStaticData: {
            Type: 37,
            Destination: 'COWES',
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        mmsi: '555666777',
        name: 'STATIC ONLY',
        shipType: 37,
        category: 'pleasure',
        destination: 'COWES',
      }),
    )
  })

  it('parses Class B StaticDataReport nested ReportedMessage', () => {
    expect(
      parseAisStreamMessage({
        MessageType: 'StaticDataReport',
        MetaData: {
          MMSI: 265566123,
          latitude: 57.6,
          longitude: 18.8,
        },
        Message: {
          StaticDataReport: {
            ReportedMessage: {
              Type: 70,
              Name: 'BALTIC TRADER',
              CallSign: 'SGAB',
            },
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        mmsi: '265566123',
        name: 'BALTIC TRADER',
        shipType: 70,
        category: 'cargo',
        callSign: 'SGAB',
      }),
    )
  })

  it('does not include category on position-only updates', () => {
    expect(
      parseAisStreamMessage({
        MessageType: 'PositionReport',
        MetaData: {
          MMSI: 123456789,
          latitude: 57.5,
          longitude: 18.5,
        },
        Message: {
          PositionReport: {
            Sog: 10,
            Cog: 90,
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        mmsi: '123456789',
        sog: 10,
        cog: 90,
      }),
    )
    expect(
      parseAisStreamMessage({
        MessageType: 'PositionReport',
        MetaData: {
          MMSI: 123456789,
          latitude: 57.5,
          longitude: 18.5,
        },
        Message: {
          PositionReport: {
            Sog: 10,
            Cog: 90,
          },
        },
      }),
    ).not.toHaveProperty('category')
  })

  it('reads lowercase coordinates from AISStream metadata', () => {
    expect(
      parseAisStreamMessage({
        MessageType: 'PositionReport',
        MetaData: {
          MMSI: 219538000,
          ShipName: 'MAERSK LABREA',
          latitude: 50.76237,
          longitude: -1.19115,
        },
        Message: {
          PositionReport: {
            Sog: 11.5,
            Cog: 273.3,
            TrueHeading: 272,
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        latitude: 50.76237,
        longitude: -1.19115,
      }),
    )
  })
})
