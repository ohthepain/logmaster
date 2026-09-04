import { describe, expect, it } from 'vitest'
import { decodeTripTrack } from '../domain/trip-track'
import { getTripTrackRecorder, resetTripTrackRecorder } from './trip-track-recorder'

describe('trip track recorder', () => {
  it('seals a chunk when max samples is reached', () => {
    resetTripTrackRecorder()
    const recorder = getTripTrackRecorder()
    const baseMs = Date.parse('2026-08-01T10:00:00.000Z')

    const sealedDuringAppend: ReturnType<typeof recorder.appendPositionSample> = []
    for (let index = 0; index < 5_000; index += 1) {
      sealedDuringAppend.push(
        ...recorder.appendPositionSample(
          'trip-1',
          {
            time: new Date(baseMs + index * 500).toISOString(),
            latitude: 50 + index * 0.0001,
            longitude: 10 + index * 0.0001,
            heading: 90,
          },
          { source: 'background-gps' },
        ),
      )
    }

    expect(sealedDuringAppend).toHaveLength(1)
    expect(sealedDuringAppend[0]?.sampleCount).toBe(5_000)
    expect(decodeTripTrack(sealedDuringAppend[0]!)).toHaveLength(5_000)
    expect(recorder.sealTrip('trip-1')).toHaveLength(0)
  })

  it('seals remaining samples when the trip ends', () => {
    resetTripTrackRecorder()
    const recorder = getTripTrackRecorder()
    recorder.appendPositionSample(
      'trip-2',
      {
        time: '2026-08-01T10:00:00.000Z',
        latitude: 50,
        longitude: 10,
        heading: null,
      },
      { source: 'background-gps' },
    )
    const sealed = recorder.sealTrip('trip-2')
    expect(sealed).toHaveLength(1)
    expect(sealed[0]?.sampleCount).toBe(1)
  })
})
