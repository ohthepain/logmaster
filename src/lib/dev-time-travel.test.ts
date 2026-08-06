import { describe, expect, it } from 'vitest'
import {
  advanceIso,
  datetimeLocalValueToIso,
  isoToDatetimeLocalValue,
} from './dev-time-travel'

describe('dev time travel helpers', () => {
  it('converts between ISO and datetime-local values', () => {
    const iso = '2026-06-15T14:30:00.000Z'
    const local = isoToDatetimeLocalValue(iso)
    expect(datetimeLocalValueToIso(local)).toBe(iso)
  })

  it('advanceIso shifts an ISO timestamp', () => {
    expect(advanceIso('2026-06-15T10:00:00.000Z', 2 * 60 * 60 * 1000)).toBe(
      '2026-06-15T12:00:00.000Z',
    )
  })
})
