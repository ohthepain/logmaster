import { describe, expect, it } from 'vitest'
import { resolveHeaderNavSegment } from './trip-nav'

describe('resolveHeaderNavSegment', () => {
  it('selects map on /map', () => {
    expect(resolveHeaderNavSegment('/map', 'live-1')).toBe('map')
  })

  it('selects trips on the trips list', () => {
    expect(resolveHeaderNavSegment('/trips', 'live-1')).toBe('trips')
  })

  it('selects live trip on the in-progress trip page', () => {
    expect(resolveHeaderNavSegment('/trips/live-1', 'live-1')).toBe('live-trip')
  })

  it('selects trips on a different trip detail page', () => {
    expect(resolveHeaderNavSegment('/trips/other-1', 'live-1')).toBe('trips')
  })

  it('returns null on unrelated pages', () => {
    expect(resolveHeaderNavSegment('/', 'live-1')).toBeNull()
  })
})
