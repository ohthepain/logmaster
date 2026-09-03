import { describe, expect, it } from 'vitest'
import {
  decodePositionTrackSamples,
  decodeScalarTrackSamples,
  type ScalarTrackDeltaV1,
  type TripTrackDeltaV1,
} from '../domain/trip-track'
import { GPX_MS_TO_KNOTS } from './gpx-field-meta'
import { buildTripFromGpx, buildTripFromGpxFiles } from './gpx-trip-import'

describe('buildTripFromGpx', () => {
  it('creates position track plus SOG and extension scalar tracks', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk><name>Test sail</name><trkseg>
    <trkpt lat="59.91" lon="10.75">
      <time>2026-06-01T09:00:00Z</time>
      <speed>2.57222</speed>
      <extensions>
        <gpxtpx:TrackPointExtension>
          <gpxtpx:hr>120</gpxtpx:hr>
        </gpxtpx:TrackPointExtension>
      </extensions>
    </trkpt>
    <trkpt lat="59.92" lon="10.76">
      <time>2026-06-01T09:01:00Z</time>
      <speed>3.0</speed>
      <extensions>
        <gpxtpx:TrackPointExtension>
          <gpxtpx:hr>130</gpxtpx:hr>
        </gpxtpx:TrackPointExtension>
      </extensions>
    </trkpt>
  </trkseg></trk>
</gpx>`

    const { trip, entries, tracks, legs } = buildTripFromGpx(gpx)
    expect(trip.status).toBe('COMPLETED')
    expect(trip.boatName).toBe('Test sail')
    expect(entries.map((entry) => entry.type)).toEqual([])
    expect(legs).toHaveLength(1)
    expect(tracks.filter((track) => track.kind === 'position')).toHaveLength(1)
    expect(tracks.map((track) => track.kind).sort()).toEqual(['gpx:hr', 'position', 'sog'])

    const positionTrack = tracks.find((track) => track.kind === 'position')!
    expect(positionTrack.legId).toBe(legs[0]?.id)
    expect(decodePositionTrackSamples(positionTrack.payload as TripTrackDeltaV1).length).toBe(2)

    const sogTrack = tracks.find((track) => track.kind === 'sog')!
    const sogSamples = decodeScalarTrackSamples(sogTrack.payload as ScalarTrackDeltaV1)
    expect(sogSamples[0]?.value).toBeCloseTo(2.57222 * GPX_MS_TO_KNOTS, 4)

    const hrTrack = tracks.find((track) => track.kind === 'gpx:hr')!
    const hrSamples = decodeScalarTrackSamples(hrTrack.payload as ScalarTrackDeltaV1)
    expect(hrSamples.map((sample) => sample.value)).toEqual([120, 130])
  })

  it('creates legs from OpenCPN trkseg breaks without synthetic log entries', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OpenCPN">
  <wpt lat="59.9000" lon="10.7400">
    <name>Harbour</name>
    <desc>Overnight stop</desc>
  </wpt>
  <trk>
    <name>Coastal passage</name>
    <trkseg>
      <trkpt lat="59.9100" lon="10.7500"><time>2026-06-01T09:00:00Z</time></trkpt>
      <trkpt lat="59.9200" lon="10.7600"><time>2026-06-01T12:00:00Z</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="59.9300" lon="10.7700"><time>2026-06-02T08:00:00Z</time></trkpt>
      <trkpt lat="59.9400" lon="10.7800"><time>2026-06-02T11:00:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`

    const { entries, tracks, legs } = buildTripFromGpx(gpx)

    expect(entries.map((entry) => entry.type)).toEqual(['NOTE'])
    expect(legs).toHaveLength(2)
    expect(legs.every((leg) => leg.title === 'Coastal passage')).toBe(true)

    const positionTracks = tracks.filter((track) => track.kind === 'position')
    expect(positionTracks).toHaveLength(2)
    expect(positionTracks[0]?.legId).toBe(legs[0]?.id)
    expect(positionTracks[1]?.legId).toBe(legs[1]?.id)

    const waypointEntry = entries.find((entry) => entry.type === 'NOTE')
    expect(waypointEntry?.data).toMatchObject({
      gpxWaypoint: true,
      place: { name: 'Harbour' },
    })
  })

  it('uses separate track names when flattening multiple OpenCPN tracks', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OpenCPN">
  <trk><name>Morning sail</name><trkseg>
    <trkpt lat="59.91" lon="10.75"><time>2026-06-01T09:00:00Z</time></trkpt>
    <trkpt lat="59.915" lon="10.755"><time>2026-06-01T10:00:00Z</time></trkpt>
  </trkseg></trk>
  <trk><name>Afternoon sail</name><trkseg>
    <trkpt lat="59.92" lon="10.76"><time>2026-06-01T14:00:00Z</time></trkpt>
    <trkpt lat="59.925" lon="10.765"><time>2026-06-01T15:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`

    const { entries, legs, tracks } = buildTripFromGpx(gpx)

    expect(entries.map((entry) => entry.type)).toEqual([])
    expect(legs.map((leg) => leg.title)).toEqual(['Morning sail', 'Afternoon sail'])
    expect(tracks.filter((track) => track.kind === 'position')).toHaveLength(2)
  })

  it('merges OpenCPN tracks and marks files into one trip with waypoint notes', () => {
    const tracksGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OpenCPN">
  <trk><name>Coastal passage</name><trkseg>
    <trkpt lat="59.9100" lon="10.7500"><time>2026-06-01T09:00:00Z</time></trkpt>
    <trkpt lat="59.9200" lon="10.7600"><time>2026-06-01T12:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`
    const marksGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OpenCPN">
  <wpt lat="59.9000" lon="10.7400"><name>Harbour</name></wpt>
</gpx>`

    const { entries, tracks } = buildTripFromGpxFiles([
      { gpxXml: tracksGpx, fileName: 'tracks.gpx' },
      { gpxXml: marksGpx, fileName: 'marks.gpx' },
    ])

    expect(tracks.filter((track) => track.kind === 'position')).toHaveLength(1)
    expect(entries.some((entry) => entry.type === 'NOTE' && entry.data?.place)).toBe(true)
  })
})
