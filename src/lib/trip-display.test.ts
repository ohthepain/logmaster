import { describe, expect, it } from 'vitest'
import type { Trip } from '../domain/logbook'
import { resolveDefaultBoatIdForNewTrip } from './trip-display'

function trip(overrides: Partial<Trip>): Trip {
  return {
    id: 'trip-1',
    boatName: 'Orca',
    startedAt: '2026-01-01T00:00:00.000Z',
    status: 'COMPLETED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('resolveDefaultBoatIdForNewTrip', () => {
  it('returns the only boat even when a last-used boat is stored', () => {
    expect(
      resolveDefaultBoatIdForNewTrip(
        [trip({ boatId: 'old-boat' })],
        [{ id: 'only-boat', name: 'Solo' }],
        'old-boat',
      ),
    ).toBe('only-boat')
  })

  it('uses the last-used boat when the user has more than one', () => {
    expect(
      resolveDefaultBoatIdForNewTrip(
        [trip({ boatId: 'recent-boat', createdAt: '2026-06-01T00:00:00.000Z' })],
        [
          { id: 'recent-boat', name: 'Recent' },
          { id: 'last-used', name: 'Favorite' },
        ],
        'last-used',
      ),
    ).toBe('last-used')
  })

  it('falls back to the most recent trip boat when last-used is missing', () => {
    expect(
      resolveDefaultBoatIdForNewTrip(
        [
          trip({
            id: 'older',
            boatId: 'older-boat',
            createdAt: '2026-01-01T00:00:00.000Z',
          }),
          trip({
            id: 'newer',
            boatId: 'newer-boat',
            createdAt: '2026-08-01T00:00:00.000Z',
          }),
        ],
        [
          { id: 'older-boat', name: 'Older' },
          { id: 'newer-boat', name: 'Newer' },
        ],
        null,
      ),
    ).toBe('newer-boat')
  })

  it('returns null when there are no boats', () => {
    expect(resolveDefaultBoatIdForNewTrip([], [], 'any')).toBeNull()
  })
})
