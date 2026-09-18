import { describe, expect, it } from 'vitest'
import {
  buildPlaybackUnderwaySegments,
  clipPlaybackUnderwaySegments,
  isPlaybackUnderway,
} from './trip-playback-underway'

const range = {
  startMs: 0,
  endMs: 10_000,
  durationMs: 10_000,
}

describe('isPlaybackUnderway', () => {
  it('is underway unless moored or anchored', () => {
    expect(isPlaybackUnderway({ moored: null, anchorDown: null })).toBe(true)
    expect(isPlaybackUnderway({ moored: false, anchorDown: false })).toBe(true)
    expect(isPlaybackUnderway({ moored: true, anchorDown: false })).toBe(false)
    expect(isPlaybackUnderway({ moored: false, anchorDown: true })).toBe(false)
  })
})

describe('buildPlaybackUnderwaySegments', () => {
  it('is green until moored or anchored', () => {
    expect(
      buildPlaybackUnderwaySegments(range, [
        { timeMs: 0, type: 'START_TRIP' },
        { timeMs: 2_000, type: 'CAST_OFF' },
        { timeMs: 8_000, type: 'MOORED' },
      ]),
    ).toEqual([{ startMs: 0, endMs: 8_000 }])
  })

  it('breaks sailing when the anchor is dropped', () => {
    expect(
      buildPlaybackUnderwaySegments(range, [
        { timeMs: 0, type: 'START_TRIP' },
        { timeMs: 1_000, type: 'CAST_OFF' },
        { timeMs: 4_000, type: 'ANCHOR_DROPPED' },
        { timeMs: 6_000, type: 'ANCHOR_WEIGHED' },
        { timeMs: 9_000, type: 'MOORED' },
      ]),
    ).toEqual([
      { startMs: 0, endMs: 4_000 },
      { startMs: 6_000, endMs: 9_000 },
    ])
  })

  it('treats a trip with no mooring events as underway', () => {
    expect(buildPlaybackUnderwaySegments(range, [])).toEqual([
      { startMs: 0, endMs: 10_000 },
    ])
  })
})

describe('clipPlaybackUnderwaySegments', () => {
  it('clips sailing spans to the visible window', () => {
    expect(
      clipPlaybackUnderwaySegments(
        [
          { startMs: 1_000, endMs: 4_000 },
          { startMs: 6_000, endMs: 9_000 },
        ],
        { startMs: 3_000, endMs: 7_000, durationMs: 4_000 },
      ),
    ).toEqual([
      { leftPercent: 0, widthPercent: 25 },
      { leftPercent: 75, widthPercent: 25 },
    ])
  })
})
