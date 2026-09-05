import { describe, expect, it } from 'vitest'
import {
  encodePositionTrackSamples,
  encodeScalarTrackSamples,
  type TripTrack,
} from '../domain/trip-track'
import {
  availablePlaybackPanels,
  buildPlaybackGraphSeries,
  defaultPlaybackViewState,
  deriveSogFromPositionSamples,
  interpolatePlaybackGraphValue,
  playbackPanelGraphPoints,
  sanitizePlaybackViewState,
} from './trip-playback-panels'

const tripId = 'trip-1'

describe('trip-playback-panels', () => {
  it('derives SOG from position samples', () => {
    const samples = deriveSogFromPositionSamples([
      {
        time: '2026-06-01T09:00:00.000Z',
        latitude: 59.9139,
        longitude: 10.7522,
      },
      {
        time: '2026-06-01T10:00:00.000Z',
        latitude: 59.9239,
        longitude: 10.7622,
      },
    ])
    expect(samples).toHaveLength(1)
    expect(samples[0]?.value).toBeGreaterThan(0)
  })

  it('lists instrument panels and omits derived SOG when instrument SOG exists', () => {
    const tracks: TripTrack[] = [
      {
        id: 'track-position',
        tripId,
        source: 'gpx-import',
        kind: 'position',
        encoding: 'delta-v1',
        payload: encodePositionTrackSamples([
          {
            time: '2026-06-01T09:00:00.000Z',
            latitude: 59.9139,
            longitude: 10.7522,
          },
          {
            time: '2026-06-01T10:00:00.000Z',
            latitude: 59.9239,
            longitude: 10.7622,
          },
        ]),
        sampleCount: 2,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T10:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
        synced: false,
      },
      {
        id: 'track-sog',
        tripId,
        source: 'instrument',
        kind: 'sog',
        encoding: 'scalar-delta-v1',
        payload: encodeScalarTrackSamples([
          { time: '2026-06-01T09:00:00.000Z', value: 4 },
          { time: '2026-06-01T10:00:00.000Z', value: 8 },
        ]),
        sampleCount: 2,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T10:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
        synced: false,
      },
    ]

    const options = availablePlaybackPanels(tripId, tracks, [])
    expect(options.map((option) => option.id)).toEqual(['log-entries', 'media', 'sog'])
    expect(options[0]?.disabled).toBe(true)
    expect(options[1]?.disabled).toBe(true)
  })

  it('always lists log entries and media in the timeline selector', () => {
    const withoutEntries = availablePlaybackPanels(tripId, [], [])
    expect(withoutEntries[0]).toMatchObject({
      id: 'log-entries',
      disabled: true,
    })
    expect(withoutEntries[1]).toMatchObject({
      id: 'media',
      disabled: true,
    })

    const withEntries = availablePlaybackPanels(tripId, [], [
      { id: 'e1', deleted: false } as never,
    ])
    expect(withEntries[0]).toMatchObject({
      id: 'log-entries',
      disabled: false,
    })
    expect(withEntries[1]).toMatchObject({
      id: 'media',
      disabled: true,
    })
  })

  it('interpolates graph values between samples', () => {
    const points = playbackPanelGraphPoints('sog', tripId, [
      {
        id: 'track-sog',
        tripId,
        source: 'instrument',
        kind: 'sog',
        encoding: 'scalar-delta-v1',
        payload: encodeScalarTrackSamples([
          { time: '2026-06-01T09:00:00.000Z', value: 4 },
          { time: '2026-06-01T10:00:00.000Z', value: 8 },
        ]),
        sampleCount: 2,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T10:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
        synced: false,
      },
    ])

    expect(
      interpolatePlaybackGraphValue(points, Date.parse('2026-06-01T09:30:00.000Z')),
    ).toBe(6)
  })

  it('defaults log entries off and enables one graph track when available', () => {
    const options = availablePlaybackPanels(tripId, [], [
      { id: 'e1', deleted: false } as never,
    ])
    const state = defaultPlaybackViewState(options)
    expect(state['log-entries']).toBe(false)
  })

  it('defaults log entries off when entries and instrument tracks are available', () => {
    const tracks: TripTrack[] = [
      {
        id: 'track-sog',
        tripId,
        source: 'instrument',
        kind: 'sog',
        encoding: 'scalar-delta-v1',
        payload: encodeScalarTrackSamples([
          { time: '2026-06-01T09:00:00.000Z', value: 4 },
        ]),
        sampleCount: 1,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:00:00.000Z',
        synced: false,
      },
    ]
    const options = availablePlaybackPanels(tripId, tracks, [
      { id: 'e1', deleted: false } as never,
    ])
    const state = defaultPlaybackViewState(options)
    expect(state['log-entries']).toBe(false)
    expect(state.sog).toBe(true)
  })

  it('builds multiple graph series with distinct colors', () => {
    const tracks: TripTrack[] = [
      {
        id: 'track-sog',
        tripId,
        source: 'instrument',
        kind: 'sog',
        encoding: 'scalar-delta-v1',
        payload: encodeScalarTrackSamples([
          { time: '2026-06-01T09:00:00.000Z', value: 4 },
        ]),
        sampleCount: 1,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:00:00.000Z',
        synced: false,
      },
      {
        id: 'track-stw',
        tripId,
        source: 'instrument',
        kind: 'stw',
        encoding: 'scalar-delta-v1',
        payload: encodeScalarTrackSamples([
          { time: '2026-06-01T09:00:00.000Z', value: 3 },
        ]),
        sampleCount: 1,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:00:00.000Z',
        synced: false,
      },
    ]
    const series = buildPlaybackGraphSeries(['sog', 'stw'], tripId, tracks)
    expect(series).toHaveLength(2)
    expect(series[0]?.color).not.toBe(series[1]?.color)
  })

  it('drops unavailable tracks when sanitizing view state', () => {
    const options = availablePlaybackPanels(tripId, [], [])
    const sanitized = sanitizePlaybackViewState(
      { sog: true, 'log-entries': false } as never,
      options,
    )
    expect(Object.keys(sanitized)).toEqual(['log-entries', 'media'])
    expect(sanitized['log-entries']).toBe(false)
  })
})
