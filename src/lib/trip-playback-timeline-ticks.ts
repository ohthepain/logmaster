import type { TripPlaybackRange } from './trip-playback'
import type { PlaybackPath } from './trip-playback-path'
import {
  playbackDistanceAtTimeMs,
  playbackTimeMsAtDistance,
} from './trip-playback-path'

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000
const MIN_LABEL_SPACING_PERCENT = 12
const MIN_LABELED_TICKS = 4
const METERS_PER_NM = 1852

const ELAPSED_STEPS_MS = [
  1_000,
  2_000,
  5_000,
  10_000,
  15_000,
  30_000,
  MINUTE_MS,
  2 * MINUTE_MS,
  5 * MINUTE_MS,
  10 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
  2 * HOUR_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
] as const

const DISTANCE_STEPS_M = [
  10,
  20,
  50,
  100,
  200,
  500,
  1_000,
  METERS_PER_NM / 2,
  METERS_PER_NM,
  2 * METERS_PER_NM,
  5 * METERS_PER_NM,
  10 * METERS_PER_NM,
  20 * METERS_PER_NM,
  50 * METERS_PER_NM,
  100 * METERS_PER_NM,
  200 * METERS_PER_NM,
] as const

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

function chooseDayLabelStep(visibleDurationMs: number): number {
  const visibleDays = Math.max(0.1, visibleDurationMs / DAY_MS)
  const niceSteps = [1, 2, 5, 10, 20, 50] as const
  for (const step of niceSteps) {
    if (visibleDays / step <= 6) return step
  }
  return 50
}

function chooseHourStep(visibleDurationMs: number): number | null {
  if (visibleDurationMs > 10 * DAY_MS) return null
  const visibleHours = visibleDurationMs / HOUR_MS
  if (visibleHours < 0.75) return null

  const niceSteps = [1, 2, 3, 6, 12] as const
  for (const step of niceSteps) {
    if (visibleHours / step <= 6) return step
  }
  return 12
}

function chooseElapsedStep(visibleDurationMs: number): number {
  const duration = Math.max(1, visibleDurationMs)
  for (let index = ELAPSED_STEPS_MS.length - 1; index >= 0; index -= 1) {
    const step = ELAPSED_STEPS_MS[index]
    if (duration / step >= MIN_LABELED_TICKS) return step
  }
  return Math.max(1, Math.floor(duration / MIN_LABELED_TICKS))
}

function dayNumberAt(timeMs: number, tripStartMs: number): number {
  return Math.floor((timeMs - tripStartMs) / DAY_MS) + 1
}

export function formatClockTickLabel(timeMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timeMs))
}

function ceilToLocalHour(timeMs: number, hourStep: number): number {
  const date = new Date(timeMs)
  const onHour =
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  date.setSeconds(0, 0)
  date.setMinutes(0)
  if (!onHour) date.setHours(date.getHours() + 1)
  const remainder = date.getHours() % hourStep
  if (remainder !== 0) date.setHours(date.getHours() + (hourStep - remainder))
  return date.getTime()
}

function nextLocalHours(timeMs: number, hours: number): number {
  const date = new Date(timeMs)
  date.setHours(date.getHours() + hours)
  return date.getTime()
}

export function formatDistanceTickLabel(meters: number): string {
  const nauticalMiles = meters / METERS_PER_NM
  if (nauticalMiles < 0.1) {
    return `${Math.max(1, Math.round(meters))} m`
  }
  if (nauticalMiles < 10) {
    const rounded = Math.round(nauticalMiles * 10) / 10
    return Number.isInteger(rounded)
      ? `${rounded.toFixed(0)} nm`
      : `${rounded.toFixed(1)} nm`
  }
  return `${Math.round(nauticalMiles)} nm`
}

function chooseDistanceStep(visibleMeters: number): number {
  const duration = Math.max(1, visibleMeters)
  for (let index = DISTANCE_STEPS_M.length - 1; index >= 0; index -= 1) {
    const step = DISTANCE_STEPS_M[index]
    if (duration / step >= MIN_LABELED_TICKS) return step
  }
  return Math.max(1, Math.floor(duration / MIN_LABELED_TICKS))
}

function computeDistanceTimelineTicks(
  window: TripPlaybackRange,
  range: TripPlaybackRange,
  path: PlaybackPath,
): TimelineTick[] {
  const ticks: TimelineTick[] = []
  const seen = new Set<number>()
  const startDistance = playbackDistanceAtTimeMs(range, path, window.startMs)
  const endDistance = playbackDistanceAtTimeMs(range, path, window.endMs)
  const visibleMeters = Math.max(1, endDistance - startDistance)
  const step = chooseDistanceStep(visibleMeters)

  const addTick = (distanceMeters: number) => {
    if (distanceMeters <= 0) return
    if (
      distanceMeters < startDistance - 0.5 ||
      distanceMeters > endDistance + 0.5
    )
      return
    const timeMs = playbackTimeMsAtDistance(range, path, distanceMeters)
    const key = Math.round(timeMs)
    if (seen.has(key)) return
    seen.add(key)
    ticks.push({
      timeMs,
      percent: percentForTime(timeMs, window),
      kind: 'hour',
      label: formatDistanceTickLabel(distanceMeters),
    })
  }

  const first = Math.ceil(startDistance / step) * step
  for (let distance = first; distance <= endDistance + 0.5; distance += step) {
    addTick(distance)
  }

  if (labeledCount(ticks) < MIN_LABELED_TICKS) {
    for (let index = 1; index <= MIN_LABELED_TICKS; index += 1) {
      addTick(startDistance + (visibleMeters * index) / MIN_LABELED_TICKS)
    }
  }

  ticks.sort((a, b) => a.timeMs - b.timeMs)
  return cullLabels(ticks)
}

export function formatElapsedTickLabel(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

function labeledCount(ticks: TimelineTick[]): number {
  return ticks.filter((tick) => tick.label).length
}

function cullLabels(ticks: TimelineTick[]): TimelineTick[] {
  const labeled = ticks
    .map((tick, index) => ({ tick, index }))
    .filter(({ tick }) => tick.label)
    .sort((a, b) => a.tick.percent - b.tick.percent)

  const dropLabel = new Set<number>()
  const keptPercents: number[] = []
  const days = labeled.filter(({ tick }) => tick.kind === 'day')
  const others = labeled.filter(({ tick }) => tick.kind !== 'day')

  const keepIfSpaced = (index: number, percent: number) => {
    const close = keptPercents.some(
      (kept) => Math.abs(percent - kept) < MIN_LABEL_SPACING_PERCENT,
    )
    if (close) {
      dropLabel.add(index)
      return
    }
    keptPercents.push(percent)
  }

  for (const { tick, index } of days) {
    keepIfSpaced(index, tick.percent)
  }
  for (const { tick, index } of others) {
    keepIfSpaced(index, tick.percent)
  }

  return ticks.map((tick, index) =>
    dropLabel.has(index)
      ? { ...tick, label: null, kind: tick.kind === 'day' ? 'day' : 'minor' }
      : tick,
  )
}

export function computePlaybackTimelineTicks(
  window: TripPlaybackRange,
  tripStartMs: number,
  options?: {
    range?: TripPlaybackRange
    path?: PlaybackPath | null
    distanceAxis?: boolean
  },
): TimelineTick[] {
  if (options?.distanceAxis && options.path && options.range) {
    return computeDistanceTimelineTicks(window, options.range, options.path)
  }

  const ticks: TimelineTick[] = []
  const seen = new Set<number>()

  const addTick = (
    timeMs: number,
    kind: TimelineTickKind,
    label: string | null,
  ) => {
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
  const dayLabelStep = chooseDayLabelStep(window.durationMs)
  for (let dayIndex = firstDayIndex; dayIndex <= lastDayIndex; dayIndex += 1) {
    const timeMs = tripStartMs + dayIndex * DAY_MS
    const dayNumber = dayNumberAt(timeMs, tripStartMs)
    const label =
      dayNumber > 0 && (dayNumber - 1) % dayLabelStep === 0
        ? `Day ${dayNumber}`
        : null
    addTick(timeMs, 'day', label)
  }

  const hourStep = chooseHourStep(window.durationMs)
  if (hourStep != null) {
    for (
      let timeMs = ceilToLocalHour(window.startMs, hourStep);
      timeMs <= window.endMs;
      timeMs = nextLocalHours(timeMs, hourStep)
    ) {
      if (timeMs <= tripStartMs || isDayBoundary(timeMs, tripStartMs)) continue
      addTick(timeMs, 'hour', formatClockTickLabel(timeMs))
    }

    if (hourStep > 1) {
      for (
        let timeMs = ceilToLocalHour(window.startMs, 1);
        timeMs <= window.endMs;
        timeMs = nextLocalHours(timeMs, 1)
      ) {
        if (timeMs <= tripStartMs || isDayBoundary(timeMs, tripStartMs))
          continue
        addTick(timeMs, 'minor', null)
      }
    }
  }

  if (labeledCount(ticks) < MIN_LABELED_TICKS) {
    const stepMs = chooseElapsedStep(window.durationMs)
    const firstElapsed =
      Math.ceil((window.startMs - tripStartMs) / stepMs) * stepMs
    for (
      let elapsed = firstElapsed;
      tripStartMs + elapsed <= window.endMs + 0.5;
      elapsed += stepMs
    ) {
      if (elapsed <= 0) continue
      const timeMs = tripStartMs + elapsed
      addTick(timeMs, 'hour', formatElapsedTickLabel(elapsed))
    }
  }

  if (labeledCount(ticks) < MIN_LABELED_TICKS) {
    for (let index = 1; index <= MIN_LABELED_TICKS; index += 1) {
      const timeMs =
        window.startMs + (window.durationMs * index) / MIN_LABELED_TICKS
      const elapsed = timeMs - tripStartMs
      if (elapsed <= 0) continue
      addTick(timeMs, 'hour', formatElapsedTickLabel(elapsed))
    }
  }

  ticks.sort((a, b) => a.timeMs - b.timeMs)
  return cullLabels(ticks)
}
