import { describe, expect, it } from 'vitest'
import { findAssetBrand, getAssetIdentity } from './asset-brands'

describe('asset brand identity', () => {
  it('separates a legacy manufacturer, model and product name', () => {
    expect(
      getAssetIdentity({
        name: 'Quark-Elec QK-A026-Plus NMEA 2000 AIS+GPS Receiver',
        modelNumber: 'Quark Elec QK-A026-Plus',
      }),
    ).toEqual({
      brand: 'Quark-Elec',
      modelNumber: 'QK-A026-Plus',
      productName: 'NMEA 2000 AIS+GPS Receiver',
      title: 'QK-A026-Plus',
      subtitle: 'NMEA 2000 AIS+GPS Receiver',
    })
  })
  it('recognizes aliases and case without matching partial brand names', () => {
    expect(findAssetBrand('QUARK ELEC')?.id).toBe('quark-elec')
    expect(findAssetBrand('victron')?.name).toBe('Victron Energy')
    expect(getAssetIdentity({ name: 'Garminish pump' }).brand).toBeNull()
  })
  it('preserves unknown manufacturers and never guesses a missing model', () => {
    expect(
      getAssetIdentity({ name: 'Acme pump', brand: 'Acme', modelNumber: null }),
    ).toMatchObject({
      brand: 'Acme',
      title: 'pump',
      subtitle: '',
      modelNumber: null,
    })
    expect(
      getAssetIdentity({ name: 'Quark Elec QK-A026-Plus receiver' })
        .modelNumber,
    ).toBeNull()
  })
  it('preserves longer model variants and mentions of brands in descriptions', () => {
    expect(
      getAssetIdentity({
        name: 'QK-A026-Plus receiver',
        modelNumber: 'QK-A026',
      }).subtitle,
    ).toBe('QK-A026-Plus receiver')
    expect(
      getAssetIdentity({
        name: 'Cable for Garmin GPS',
        description: 'Garmin compatible',
      }).brand,
    ).toBeNull()
  })
  it('keeps model-only and unbranded assets readable', () => {
    expect(
      getAssetIdentity({
        name: 'Garmin GPSMAP 923',
        modelNumber: 'GPSMAP 923',
      }),
    ).toMatchObject({ title: 'GPSMAP 923', subtitle: '' })
    expect(getAssetIdentity({ name: 'Spare anchor' })).toMatchObject({
      brand: null,
      title: 'Spare anchor',
      subtitle: '',
    })
  })
})
