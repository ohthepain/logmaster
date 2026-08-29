import { describe, expect, it } from 'vitest'
import { computePlaybackTimelineTicks } from './trip-playback-timeline-ticks'

const HOUR = 3_600_000
const DAY = 86_400_000

describe('computePlaybackTimelineTicks', () => {
  it('labels day boundaries relative to trip start', () => {
    const tripStart = Date.parse('2026-06-01T08:00:00Z')
    const window = {
      startMs: tripStart,
      endMs: tripStart + 2.5 * DAY,
      durationMs: 2.5 * DAY,
    }
    const ticks = computePlaybackTimelineTicks(window, tripStart)
    const dayLabels = ticks.filter((tick) => tick.label?.startsWith('Day ')).map((tick) => tick.label)
    expect(dayLabels).toContain('Day 1')
    expect(dayLabels).toContain('Day 2')
    expect(dayLabels).toContain('Day 3')
  })

  it('shows hour labels when zoomed in', () => {
    const tripStart = Date.parse('2026-06-01T08:00:00Z')
    const window = {
      startMs: tripStart,
      endMs: tripStart + 8 * HOUR,
      durationMs: 8 * HOUR,
    }
    const ticks = computePlaybackTimelineTicks(window, tripStart)
    const hourLabels = ticks.filter((tick) => tick.label?.endsWith('h')).map((tick) => tick.label)
    expect(hourLabels).toContain('1h')
    expect(hourLabels).toContain('2h')
    expect(hourLabels).not.toContain('0h')
  })

  it('prefers day labels over colliding hour labels', () => {
    const tripStart = Date.parse('2026-06-01T08:00:00Z')
    const window = {
      startMs: tripStart + DAY - 2 * HOUR,
      endMs: tripStart + DAY + 2 * HOUR,
      durationMs: 4 * HOUR,
    }
    const ticks = computePlaybackTimelineTicks(window, tripStart)
    const atDayTwo = ticks.find((tick) => tick.timeMs === tripStart + DAY)
    expect(atDayTwo?.label).toBe('Day 2')
    expect(ticks.some((tick) => tick.label === '24h')).toBe(false)
  })
})
