import type { LogEntry, LogEntryType } from '../domain/logbook'
import type { TripPlaybackRange } from './trip-playback'

const UNDERWAY_ENTRY_TYPES = new Set<LogEntryType>([
  'MOORED',
  'CAST_OFF',
  'ANCHOR_DROPPED',
  'ANCHOR_WEIGHED',
])

export type PlaybackUnderwaySegment = {
  startMs: number
  endMs: number
}

export type PlaybackUnderwayTrackStop = {
  leftPercent: number
  widthPercent: number
}

type MooringFlags = {
  moored: boolean | null
  anchorDown: boolean | null
}

export function isPlaybackUnderway(flags: MooringFlags): boolean {
  return flags.moored !== true && flags.anchorDown !== true
}

function applyMooringEvent(flags: MooringFlags, type: LogEntryType) {
  switch (type) {
    case 'MOORED':
      flags.moored = true
      break
    case 'CAST_OFF':
      flags.moored = false
      break
    case 'ANCHOR_DROPPED':
      flags.anchorDown = true
      break
    case 'ANCHOR_WEIGHED':
      flags.anchorDown = false
      break
  }
}

export function buildPlaybackUnderwaySegments(
  range: TripPlaybackRange,
  events: Array<{ timeMs: number; type: LogEntryType }>,
): PlaybackUnderwaySegment[] {
  const flags: MooringFlags = { moored: null, anchorDown: null }
  const sorted = [...events]
    .filter((event) => UNDERWAY_ENTRY_TYPES.has(event.type))
    .sort((left, right) => left.timeMs - right.timeMs)

  let index = 0
  while (index < sorted.length && sorted[index].timeMs <= range.startMs) {
    applyMooringEvent(flags, sorted[index].type)
    index += 1
  }

  const segments: PlaybackUnderwaySegment[] = []
  let underway = isPlaybackUnderway(flags)
  let segmentStart = range.startMs

  const closeSegment = (endMs: number) => {
    if (underway && endMs > segmentStart) {
      segments.push({ startMs: segmentStart, endMs })
    }
  }

  for (; index < sorted.length; index += 1) {
    const event = sorted[index]
    if (event.timeMs >= range.endMs) break
    const nextFlags = { ...flags }
    applyMooringEvent(nextFlags, event.type)
    const nextUnderway = isPlaybackUnderway(nextFlags)
    if (nextUnderway !== underway) {
      closeSegment(event.timeMs)
      if (nextUnderway) segmentStart = event.timeMs
      underway = nextUnderway
    }
    flags.moored = nextFlags.moored
    flags.anchorDown = nextFlags.anchorDown
  }

  closeSegment(range.endMs)
  return segments
}

export function clipPlaybackUnderwaySegments(
  segments: PlaybackUnderwaySegment[],
  window: TripPlaybackRange,
): PlaybackUnderwayTrackStop[] {
  const durationMs = Math.max(1, window.durationMs)
  const stops: PlaybackUnderwayTrackStop[] = []
  for (const segment of segments) {
    const startMs = Math.max(segment.startMs, window.startMs)
    const endMs = Math.min(segment.endMs, window.endMs)
    if (endMs <= startMs) continue
    stops.push({
      leftPercent: ((startMs - window.startMs) / durationMs) * 100,
      widthPercent: ((endMs - startMs) / durationMs) * 100,
    })
  }
  return stops
}

export function playbackUnderwayEventsFromEntries<
  T extends Pick<LogEntry, 'type' | 'deleted'>,
>(
  entries: T[],
  timeMsForEntry: (entry: T) => number,
): Array<{ timeMs: number; type: LogEntryType }> {
  return entries
    .filter((entry) => !entry.deleted && UNDERWAY_ENTRY_TYPES.has(entry.type))
    .map((entry) => ({ timeMs: timeMsForEntry(entry), type: entry.type }))
}
