import type { TripPlaybackRange } from './trip-playback'

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const MIN_LABEL_SPACING_PERCENT = 7

export type TimelineTickKind = 'day' | 'hour' | 'minor'

export type TimelineTick = {
  timeMs: number
  percent: number
  kind: TimelineTickKind
  label: string | null
}

function percentForTime(timeMs: number, window: TripPlaybackRange): number {
  return ((timeMs - window.startMs) / window.durationMs) * 100
}

function isDayBoundary(timeMs: number, tripStartMs: number): boolean {
  return Math.abs((timeMs - tripStartMs) % DAY_MS) < 1
}

function chooseHourStep(visibleDurationMs: number): number | null {
  if (visibleDurationMs > 10 * DAY_MS) return null
  const visibleHours = visibleDurationMs / HOUR_MS
  if (visibleHours < 0.75) return null

  const niceSteps = [1, 2, 3, 6, 12] as const
  for (const step of niceSteps) {
    if (visibleHours / step <= 10) return step
  }
  return 12
}

function dayNumberAt(timeMs: number, tripStartMs: number): number {
  return Math.floor((timeMs - tripStartMs) / DAY_MS) + 1
}

function hourLabel(timeMs: number, tripStartMs: number): string {
  const hours = Math.round((timeMs - tripStartMs) / HOUR_MS)
  return `${hours}h`
}

function cullLabels(ticks: TimelineTick[]): TimelineTick[] {
  const sorted = ticks
    .map((tick, index) => ({ tick, index }))
    .filter(({ tick }) => tick.label)
    .sort((a, b) => {
      if (a.tick.percent !== b.tick.percent) return a.tick.percent - b.tick.percent
      return a.tick.kind === 'day' ? -1 : 1
    })

  const dropLabel = new Set<number>()
  let lastPercent = -Infinity
  for (const { tick, index } of sorted) {
    if (tick.percent - lastPercent < MIN_LABEL_SPACING_PERCENT) {
      dropLabel.add(index)
      continue
    }
    lastPercent = tick.percent
  }

  return ticks.map((tick, index) =>
    dropLabel.has(index) ? { ...tick, label: null, kind: tick.kind === 'day' ? 'day' : 'minor' } : tick,
  )
}

export function computePlaybackTimelineTicks(
  window: TripPlaybackRange,
  tripStartMs: number,
): TimelineTick[] {
  const ticks: TimelineTick[] = []
  const seen = new Set<number>()

  const addTick = (timeMs: number, kind: TimelineTickKind, label: string | null) => {
    if (timeMs < window.startMs || timeMs > window.endMs) return
    const key = Math.round(timeMs)
    if (seen.has(key)) return
    seen.add(key)
    ticks.push({
      timeMs,
      percent: percentForTime(timeMs, window),
      kind,
      label,
    })
  }

  const firstDayIndex = Math.floor((window.startMs - tripStartMs) / DAY_MS)
  const lastDayIndex = Math.ceil((window.endMs - tripStartMs) / DAY_MS)
  for (let dayIndex = firstDayIndex; dayIndex <= lastDayIndex; dayIndex += 1) {
    const timeMs = tripStartMs + dayIndex * DAY_MS
    addTick(timeMs, 'day', `Day ${dayNumberAt(timeMs, tripStartMs)}`)
  }

  const hourStep = chooseHourStep(window.durationMs)
  if (hourStep != null) {
    const firstHour = Math.ceil((window.startMs - tripStartMs) / HOUR_MS / hourStep) * hourStep
    for (
      let hour = firstHour;
      hour * HOUR_MS + tripStartMs <= window.endMs;
      hour += hourStep
    ) {
      const timeMs = tripStartMs + hour * HOUR_MS
      if (hour <= 0 || isDayBoundary(timeMs, tripStartMs)) continue
      addTick(timeMs, 'hour', hourLabel(timeMs, tripStartMs))
    }

    if (hourStep > 1) {
      for (let hour = firstHour; hour * HOUR_MS + tripStartMs <= window.endMs; hour += 1) {
        const timeMs = tripStartMs + hour * HOUR_MS
        if (hour <= 0 || isDayBoundary(timeMs, tripStartMs)) continue
        if (hour % hourStep === 0) continue
        addTick(timeMs, 'minor', null)
      }
    }
  }

  ticks.sort((a, b) => a.timeMs - b.timeMs)
  return cullLabels(ticks)
}
