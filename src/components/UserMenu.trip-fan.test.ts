import { describe, expect, it } from 'vitest'
import type { Trip } from '../domain/logbook'
import { tripsForMenuFan } from './UserMenu'

function trip(id: string, updatedAt: string): Trip {
  return {
    id,
    boatName: id,
    startedAt: updatedAt,
    status: 'COMPLETED',
    createdAt: updatedAt,
    updatedAt,
  }
}

describe('tripsForMenuFan', () => {
  it('puts the most recently updated trip last so it sits on the right', () => {
    const fan = tripsForMenuFan([
      trip('older', '2026-01-01T00:00:00.000Z'),
      trip('newest', '2026-09-01T00:00:00.000Z'),
      trip('middle', '2026-06-01T00:00:00.000Z'),
    ])

    expect(fan.map((item) => item.id)).toEqual(['older', 'middle', 'newest'])
  })

  it('keeps only the three most recent trips', () => {
    const fan = tripsForMenuFan([
      trip('a', '2026-01-01T00:00:00.000Z'),
      trip('b', '2026-02-01T00:00:00.000Z'),
      trip('c', '2026-03-01T00:00:00.000Z'),
      trip('d', '2026-04-01T00:00:00.000Z'),
    ])

    expect(fan.map((item) => item.id)).toEqual(['b', 'c', 'd'])
  })
})
