import { describe, expect, it } from 'vitest'
import {
  TRIP_TRACK_FIT_MARGIN_FRACTION,
  tripTrackFitPadding,
} from './sailing-map-viewport'

describe('tripTrackFitPadding', () => {
  it('uses a 10% margin on each edge', () => {
    expect(tripTrackFitPadding({ width: 400, height: 800 })).toEqual({
      top: Math.round(800 * TRIP_TRACK_FIT_MARGIN_FRACTION),
      bottom: Math.round(800 * TRIP_TRACK_FIT_MARGIN_FRACTION),
      left: Math.round(400 * TRIP_TRACK_FIT_MARGIN_FRACTION),
      right: Math.round(400 * TRIP_TRACK_FIT_MARGIN_FRACTION),
    })
  })
})
