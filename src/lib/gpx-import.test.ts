import { describe, expect, it } from 'vitest'
import {
  downsampleGpxPoints,
  gpxImportBoatName,
  parseGpx,
  type GpxTrackPoint,
} from './gpx-import'

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="logmaster-test">
  <metadata>
    <name>Harbour day sail</name>
  </metadata>
  <trk>
    <name>Day sail</name>
    <trkseg>
      <trkpt lat="59.9139" lon="10.7522">
        <time>2026-06-01T09:00:00Z</time>
      </trkpt>
      <trkpt lat="59.9200" lon="10.7600">
        <time>2026-06-01T10:00:00Z</time>
      </trkpt>
      <trkpt lat="59.9300" lon="10.7700">
        <time>2026-06-01T11:00:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('gpx-import', () => {
  it('parses track points with timestamps', () => {
    const parsed = parseGpx(SAMPLE_GPX)
    expect(parsed.name).toBe('Day sail')
    expect(parsed.points).toHaveLength(3)
    expect(parsed.points[0]).toMatchObject({
      latitude: 59.9139,
      longitude: 10.7522,
      time: '2026-06-01T09:00:00.000Z',
    })
    expect(parsed.points[2]?.heading).toBeTypeOf('number')
  })

  it('derives a boat name from the track or file name', () => {
    const parsed = parseGpx(SAMPLE_GPX)
    expect(gpxImportBoatName(parsed, 'archive.gpx')).toBe('Day sail')
    expect(gpxImportBoatName({ name: null, points: parsed.points }, 'sunset.gpx')).toBe(
      'sunset',
    )
  })

  it('downsamples long tracks while keeping endpoints', () => {
    const points: GpxTrackPoint[] = Array.from({ length: 10 }, (_, index) => ({
      latitude: 59 + index * 0.01,
      longitude: 10 + index * 0.01,
      time: new Date(Date.parse('2026-06-01T09:00:00Z') + index * 60_000).toISOString(),
      elevationM: null,
      heading: null,
    }))
    const sampled = downsampleGpxPoints(points, 4)
    expect(sampled).toHaveLength(4)
    expect(sampled[0]).toEqual(points[0])
    expect(sampled[sampled.length - 1]).toEqual(points[points.length - 1])
  })

  it('rejects files without points', () => {
    expect(() =>
      parseGpx('<gpx version="1.1"><metadata><name>Empty</name></metadata></gpx>'),
    ).toThrow(/No track points/)
  })

  it('keeps duplicate timestamps in document order', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ExampleCreator" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Example Track</name>
    <trkseg>
      <trkpt lat="40.0" lon="-105.0">
        <time>2024-06-15T14:46:21Z</time>
      </trkpt>
      <trkpt lat="40.1" lon="-105.1">
        <time>2024-06-15T14:46:21Z</time>
      </trkpt>
      <trkpt lat="40.2" lon="-105.2">
        <time>2024-06-15T14:47:21Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

    const parsed = parseGpx(gpx)
    expect(parsed.points).toHaveLength(3)
    expect(parsed.points.map((point) => point.latitude)).toEqual([40.0, 40.1, 40.2])
    expect(parsed.points[0]?.time).toBe('2024-06-15T14:46:21.000Z')
    expect(parsed.points[1]?.time).toBe('2024-06-15T14:46:21.000Z')
    expect(parsed.points[2]?.time).toBe('2024-06-15T14:47:21.000Z')
  })

  it('sorts out-of-order timestamps chronologically', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ExampleCreator" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Example Track with Wrong Timestamp Order</name>
    <trkseg>
      <trkpt lat="40.0" lon="-105.0">
        <time>2024-06-15T14:46:21Z</time>
      </trkpt>
      <trkpt lat="40.1" lon="-105.1">
        <time>2024-06-15T14:45:21Z</time>
      </trkpt>
      <trkpt lat="40.2" lon="-105.2">
        <time>2024-06-15T14:47:21Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

    const parsed = parseGpx(gpx)
    expect(parsed.points).toHaveLength(3)
    expect(parsed.points.map((point) => point.time)).toEqual([
      '2024-06-15T14:45:21.000Z',
      '2024-06-15T14:46:21.000Z',
      '2024-06-15T14:47:21.000Z',
    ])
    expect(parsed.points.map((point) => point.latitude)).toEqual([40.1, 40.0, 40.2])
  })
})
