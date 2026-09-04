import { describe, expect, it } from 'vitest'
import type { Trip } from '../domain/logbook'
import {
  createDevTripRetrip,
  pauseDevTripRetripState,
  resumeDevTripRetripState,
  retripDurationMs,
  retripSourceElapsedMs,
  retripSourceTimeMs,
  retripWithTimescale,
  type DevTripRetrip,
} from './dev-trip-retrip'

const trip: Trip = {
  id: 'source',
  boatName: 'Aeolus',
  title: 'Summer passage',
  startedAt: '2026-08-01T10:00:00.000Z',
  completedAt: '2026-08-01T12:00:00.000Z',
  startLatitude: 50,
  startLongitude: 10,
  status: 'COMPLETED',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
}

describe('dev trip retrip', () => {
  it('starts paused at source elapsed zero', () => {
    const startedMs = Date.parse('2026-08-27T08:00:00.000Z')
    const state = createDevTripRetrip('source', 1, startedMs)

    expect(state.paused).toBe(true)
    expect(state.pausedSourceElapsedMs).toBe(0)
    expect(retripSourceElapsedMs(state, Date.parse('2026-08-27T08:30:00.000Z'))).toBe(0)
    expect(retripSourceTimeMs(trip, retripSourceElapsedMs(state, startedMs))).toBe(
      Date.parse('2026-08-01T10:00:00.000Z'),
    )
  })

  it('maps wall clock to source elapsed at 1x after resume', () => {
    const startedMs = Date.parse('2026-08-27T08:00:00.000Z')
    const state = resumeDevTripRetripState(createDevTripRetrip('source', 1, startedMs), startedMs)
    const nowMs = Date.parse('2026-08-27T08:30:00.000Z')

    expect(retripSourceElapsedMs(state, nowMs)).toBe(30 * 60 * 1000)
    expect(retripSourceTimeMs(trip, retripSourceElapsedMs(state, nowMs))).toBe(
      Date.parse('2026-08-01T10:30:00.000Z'),
    )
  })

  it('applies timescale to source elapsed after resume', () => {
    const startedMs = Date.parse('2026-08-27T08:00:00.000Z')
    const state = resumeDevTripRetripState(createDevTripRetrip('source', 10, startedMs), startedMs)
    const nowMs = Date.parse('2026-08-27T08:01:00.000Z')

    expect(retripSourceElapsedMs(state, nowMs)).toBe(10 * 60 * 1000)
  })

  it('freezes elapsed while paused', () => {
    const startedMs = Date.parse('2026-08-27T08:00:00.000Z')
    let state: DevTripRetrip = resumeDevTripRetripState(
      createDevTripRetrip('source', 1, startedMs),
      startedMs,
    )
    const pauseMs = Date.parse('2026-08-27T08:10:00.000Z')
    state = pauseDevTripRetripState(state, pauseMs)

    expect(retripSourceElapsedMs(state, pauseMs)).toBe(10 * 60 * 1000)
    expect(retripSourceElapsedMs(state, Date.parse('2026-08-27T08:20:00.000Z'))).toBe(
      10 * 60 * 1000,
    )
  })

  it('continues from the paused point after resume', () => {
    const startedMs = Date.parse('2026-08-27T08:00:00.000Z')
    let state: DevTripRetrip = resumeDevTripRetripState(
      createDevTripRetrip('source', 1, startedMs),
      startedMs,
    )
    state = pauseDevTripRetripState(state, Date.parse('2026-08-27T08:10:00.000Z'))
    state = resumeDevTripRetripState(state, Date.parse('2026-08-27T08:25:00.000Z'))

    expect(retripSourceElapsedMs(state, Date.parse('2026-08-27T08:35:00.000Z'))).toBe(
      20 * 60 * 1000,
    )
  })

  it('derives duration from trip playback range', () => {
    expect(retripDurationMs(trip, [], [])).toBe(2 * 60 * 60 * 1000)
  })

  it('preserves source elapsed when changing timescale', () => {
    const startedMs = Date.parse('2026-08-27T08:00:00.000Z')
    const nowMs = Date.parse('2026-08-27T08:10:00.000Z')
    const state = resumeDevTripRetripState(createDevTripRetrip('source', 1, startedMs), startedMs)
    const faster = retripWithTimescale(state, 10, nowMs)

    expect(retripSourceElapsedMs(state, nowMs)).toBe(10 * 60 * 1000)
    expect(retripSourceElapsedMs(faster, nowMs)).toBe(10 * 60 * 1000)
  })
})
