import { describe, expect, it, vi } from 'vitest'
import {
  attachPlaceToEntryData,
  entryPlaceFromData,
  formatPositionDisplay,
  lookupActivityLocationName,
} from './logbook-place'
import {
  fetchReverseLocationName,
  fetchReversePlaceLookup,
} from './place-reverse-lookup-api'

vi.mock('./place-reverse-lookup-api', () => ({
  fetchReversePlaceLookup: vi.fn(async () => ({
    name: 'Cowes Roads',
    detail: null,
    kind: 'bay',
    source: 'osm',
    layerId: 'osm-bay',
    distanceM: 900,
    latitude: 50.77,
    longitude: -1.29,
  })),
  fetchReverseLocationName: vi.fn(async () => 'Cowes, England'),
  formatReversePlaceLabel: (place: { name: string; detail?: string | null }) =>
    place.detail ? `${place.name} (${place.detail})` : place.name,
}))

describe('logbook-place', () => {
  it('formats saved entry place with coordinates', () => {
    expect(
      formatPositionDisplay(50.78, -1.3, {
        name: 'Cowes Roads',
        detail: null,
        kind: 'bay',
        source: 'osm',
        distanceM: 900,
      }),
    ).toContain('Cowes Roads')
    expect(
      formatPositionDisplay(50.78, -1.3, {
        name: 'Cowes Roads',
        detail: null,
        kind: 'bay',
        source: 'osm',
        distanceM: 900,
      }),
    ).toContain('50.7800')
  })

  it('reads place metadata from entry data', () => {
    expect(
      entryPlaceFromData({
        place: {
          name: 'Cowes',
          detail: null,
          kind: 'town',
          source: 'geonames',
          distanceM: 42,
        },
      })?.name,
    ).toBe('Cowes')
  })

  it('attaches reverse lookup results when saving entries', async () => {
    const data = await attachPlaceToEntryData({}, 50.78, -1.3)
    expect(entryPlaceFromData(data)?.name).toBe('Cowes Roads')
  })

  it('uses a reverse-geocoded name when no nearby place exists', async () => {
    vi.mocked(fetchReversePlaceLookup).mockResolvedValueOnce(null)
    await expect(lookupActivityLocationName(50.78, -1.3)).resolves.toBe(
      'Cowes, England',
    )
    expect(fetchReverseLocationName).toHaveBeenCalledWith(50.78, -1.3)
  })
})
