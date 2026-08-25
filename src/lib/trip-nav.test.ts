import { describe, expect, it } from 'vitest'
import { resolveHeaderNavSegment } from './trip-nav'

describe('resolveHeaderNavSegment', () => {
  it('selects map on /map', () => {
    expect(resolveHeaderNavSegment('/map')).toBe('map')
  })

  it('selects trips on the trips list', () => {
    expect(resolveHeaderNavSegment('/trips')).toBe('trips')
  })

  it('selects map on a trip detail page', () => {
    expect(resolveHeaderNavSegment('/trips/live-1')).toBe('map')
  })

  it('returns null on unrelated pages', () => {
    expect(resolveHeaderNavSegment('/')).toBeNull()
  })
})
