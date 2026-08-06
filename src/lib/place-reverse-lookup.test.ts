import { describe, expect, it } from 'vitest'
import { pickNearestPlace } from './place-reverse-lookup'

describe('pickNearestPlace', () => {
  it('prefers closer named places within range', () => {
    const result = pickNearestPlace(
      [
        {
          name: 'Far Harbour',
          kind: 'harbour',
          source: 'osm',
          latitude: 50.8,
          longitude: -1.2,
          priority: 2,
        },
        {
          name: 'Solent',
          kind: 'bay',
          source: 'osm',
          latitude: 50.761,
          longitude: -1.297,
          priority: 3,
        },
      ],
      50.7628,
      -1.2974,
    )
    expect(result?.name).toBe('Solent')
    expect(result?.kind).toBe('bay')
  })

  it('returns null when nothing is within max distance', () => {
    const result = pickNearestPlace(
      [
        {
          name: 'Distant Island',
          kind: 'island',
          source: 'osm',
          latitude: 55,
          longitude: -8,
          priority: 3,
        },
      ],
      50.7628,
      -1.2974,
      { maxDistanceM: 1000 },
    )
    expect(result).toBeNull()
  })
})
