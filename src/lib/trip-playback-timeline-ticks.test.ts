import { describe, expect, it } from 'vitest'
import { buildPlaybackPath } from './trip-playback-path'
import {
  computePlaybackTimelineTicks,
  formatClockTickLabel,
  formatDistanceTickLabel,
} from './trip-playback-timeline-ticks'

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
    const dayLabels = ticks
      .filter((tick) => tick.label?.startsWith('Day '))
      .map((tick) => tick.label)
    expect(dayLabels).toContain('Day 1')
    expect(dayLabels).toContain('Day 2')
    expect(dayLabels).toContain('Day 3')
  })

  it('labels hour ticks with clock time instead of elapsed hours', () => {
    const tripStart = Date.parse('2026-06-01T08:00:00Z')
    const window = {
      startMs: tripStart,
      endMs: tripStart + 2.5 * DAY,
      durationMs: 2.5 * DAY,
    }
    const ticks = computePlaybackTimelineTicks(window, tripStart)
    const hourTicks = ticks.filter((tick) => tick.kind === 'hour' && tick.label)
    expect(hourTicks.length).toBeGreaterThan(0)
    expect(hourTicks.map((tick) => tick.label)).not.toContain('12h')
    expect(hourTicks.map((tick) => tick.label)).not.toContain('36h')
    for (const tick of hourTicks) {
      expect(tick.label).toBe(formatClockTickLabel(tick.timeMs))
    }
  })

  it('leaves gaps between labeled ticks so legend text does not overlap', () => {
    const tripStart = Date.parse('2026-06-01T08:00:00Z')
    const window = {
      startMs: tripStart,
      endMs: tripStart + 2.5 * DAY,
      durationMs: 2.5 * DAY,
    }
    const ticks = computePlaybackTimelineTicks(window, tripStart)
    const labeled = ticks
      .filter((tick) => tick.label)
      .sort((a, b) => a.percent - b.percent)
    expect(labeled.length).toBeGreaterThan(1)
    for (let index = 1; index < labeled.length; index += 1) {
      expect(
        labeled[index].percent - labeled[index - 1].percent,
      ).toBeGreaterThanOrEqual(12)
    }
  })

  it('shows clock times when zoomed in to hours', () => {
    const tripStart = Date.parse('2026-06-01T08:00:00Z')
    const window = {
      startMs: tripStart,
      endMs: tripStart + 8 * HOUR,
      durationMs: 8 * HOUR,
    }
    const ticks = computePlaybackTimelineTicks(window, tripStart)
    const hourTicks = ticks.filter((tick) => tick.kind === 'hour' && tick.label)
    expect(hourTicks.length).toBeGreaterThanOrEqual(4)
    expect(hourTicks.some((tick) => tick.label?.endsWith('h'))).toBe(false)
    for (const tick of hourTicks) {
      expect(tick.label).toBe(formatClockTickLabel(tick.timeMs))
    }
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
    expect(
      ticks.some(
        (tick) =>
          tick.timeMs === tripStart + DAY &&
          tick.label === formatClockTickLabel(tripStart + DAY),
      ),
    ).toBe(false)
  })

  it('keeps at least four labeled ticks on a one-minute trip', () => {
    const tripStart = Date.parse('2026-06-01T08:00:00Z')
    const window = {
      startMs: tripStart,
      endMs: tripStart + 60_000,
      durationMs: 60_000,
    }
    const ticks = computePlaybackTimelineTicks(window, tripStart)
    const labels = ticks.filter((tick) => tick.label).map((tick) => tick.label)
    expect(labels.length).toBeGreaterThanOrEqual(4)
    expect(labels).toContain('15s')
    expect(labels).toContain('30s')
    expect(labels).toContain('45s')
    expect(labels).toContain('1m')
  })

  it('keeps at least four labeled ticks on a twenty-minute trip', () => {
    const tripStart = Date.parse('2026-06-01T08:00:00Z')
    const window = {
      startMs: tripStart,
      endMs: tripStart + 20 * 60_000,
      durationMs: 20 * 60_000,
    }
    const ticks = computePlaybackTimelineTicks(window, tripStart)
    const labels = ticks.filter((tick) => tick.label).map((tick) => tick.label)
    expect(labels.length).toBeGreaterThanOrEqual(4)
    expect(labels).toContain('5m')
    expect(labels).toContain('10m')
    expect(labels).toContain('15m')
    expect(labels).toContain('20m')
  })
})

describe('distance timeline ticks', () => {
  it('labels a route-length window in nautical miles', () => {
    const path = buildPlaybackPath(
      [
        {
          time: '2026-06-01T08:00:00.000Z',
          latitude: 50,
          longitude: 0,
        },
        {
          time: '2026-06-01T08:00:01.000Z',
          latitude: 50.3,
          longitude: 0,
        },
      ],
      [],
    )!
    const range = { startMs: 0, endMs: 1_000, durationMs: 1_000 }
    const ticks = computePlaybackTimelineTicks(range, 0, {
      range,
      path,
      distanceAxis: true,
    })
    const labels = ticks.filter((tick) => tick.label).map((tick) => tick.label)
    expect(labels.length).toBeGreaterThanOrEqual(4)
    expect(labels.some((label) => label?.endsWith('nm'))).toBe(true)
    expect(labels).not.toContain('1s')
  })

  it('uses half-mile ticks on a few-mile route', () => {
    const path = buildPlaybackPath(
      [
        {
          time: '2026-06-01T08:00:00.000Z',
          latitude: 50,
          longitude: 0,
        },
        {
          time: '2026-06-01T08:00:01.000Z',
          latitude: 50.054,
          longitude: 0,
        },
      ],
      [],
    )!
    const range = { startMs: 0, endMs: 1_000, durationMs: 1_000 }
    const ticks = computePlaybackTimelineTicks(range, 0, {
      range,
      path,
      distanceAxis: true,
    })
    const labels = ticks.filter((tick) => tick.label).map((tick) => tick.label)
    expect(labels).toEqual(
      expect.arrayContaining(['0.5 nm', '1 nm', '1.5 nm', '2 nm']),
    )
  })

  it('formats short distances in meters', () => {
    expect(formatDistanceTickLabel(50)).toBe('50 m')
    expect(formatDistanceTickLabel(1852)).toBe('1 nm')
  })
})
