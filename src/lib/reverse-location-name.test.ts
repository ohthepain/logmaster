import { describe, expect, it } from 'vitest'
import { formatReverseGeocodedLocationName } from './reverse-location-name'

describe('formatReverseGeocodedLocationName', () => {
  it('prefers a town and its region over the country', () => {
    expect(
      formatReverseGeocodedLocationName({
        town: 'Cowes',
        county: 'Isle of Wight',
        state: 'England',
        country: 'United Kingdom',
      }),
    ).toBe('Cowes, Isle of Wight')
  })

  it('uses the first display-name segment for open water', () => {
    expect(
      formatReverseGeocodedLocationName(
        { country: 'Sweden' },
        'Baltic Sea, Sweden',
      ),
    ).toBe('Baltic Sea, Sweden')
  })

  it('ignores raw coordinate strings', () => {
    expect(
      formatReverseGeocodedLocationName(null, '59.3000, 18.1000'),
    ).toBeNull()
  })
})
