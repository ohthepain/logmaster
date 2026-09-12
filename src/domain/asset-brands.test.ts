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

it('recognizes accented spellings and legacy brand aliases', () => {
  expect(findAssetBrand('Selden')?.name).toBe('Seldén')
  expect(findAssetBrand('Seldén')?.name).toBe('Seldén')
  expect(findAssetBrand('Side-Power')?.name).toBe('Sleipner')
  expect(findAssetBrand('B and G')?.name).toBe('B&G')
})

it('prefers a longer manufacturer alias and strips it completely', () => {
  expect(
    getAssetIdentity({
      name: 'Mercury MerCruiser 4.5L Sterndrive',
      modelNumber: 'Mercury MerCruiser 4.5L',
    }),
  ).toMatchObject({
    brand: 'MerCruiser',
    modelNumber: '4.5L',
    title: '4.5L',
    subtitle: 'Sterndrive',
  })
})

it('does not infer brands from common words or override a cleared brand', () => {
  for (const name of [
    'Quick release',
    'Whale watching camera',
    'Spade anchor',
  ]) {
    expect(getAssetIdentity({ name })).toMatchObject({
      brand: null,
      title: name,
    })
  }
  expect(
    getAssetIdentity({
      name: 'Quick DP2 windlass',
      brand: 'Quick',
      modelNumber: 'DP2',
    }),
  ).toMatchObject({ brand: 'Quick', title: 'DP2', subtitle: 'windlass' })
  expect(getAssetIdentity({ name: 'Garmin GPS', brand: '' }).brand).toBeNull()
})
