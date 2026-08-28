import { describe, expect, it } from 'vitest'
import {
  advanceIso,
  datetimeLocalValueToIso,
  effectiveTimeTravelIso,
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

  it('keeps a selected replay time moving with the real clock', () => {
    expect(
      effectiveTimeTravelIso(
        '2026-01-01T12:00:00.000Z',
        '2026-08-27T10:00:00.000Z',
        Date.parse('2026-08-27T10:15:00.000Z'),
      ),
    ).toBe('2026-01-01T12:15:00.000Z')
  })
})
