import { describe, expect, it } from 'vitest'
import type { Trip } from '../domain/logbook'
import { resolveMapModeTrip } from './trip-nav'

const trip = (status: Trip['status'], id: string): Trip =>
  ({ id, status }) as Trip

describe('resolveMapModeTrip', () => {
  it('prefers an active trip over a planned trip', () => {
    const active = trip('IN_PROGRESS', 'active')
    const planned = trip('PLANNED', 'planned')

    expect(resolveMapModeTrip([planned, active])).toBe(active)
  })

  it('returns a planned trip when there is no active trip', () => {
    const planned = trip('PLANNED', 'planned')

    expect(resolveMapModeTrip([trip('COMPLETED', 'done'), planned])).toBe(
      planned,
    )
  })

  it('does not reopen a completed trip in map mode', () => {
    expect(resolveMapModeTrip([trip('COMPLETED', 'done')])).toBeNull()
  })
})
