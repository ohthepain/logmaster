import { describe, expect, it } from 'vitest'
import {
  downsampleGpxPoints,
  downsampleGpxSegments,
  decodeXmlText,
  discoverGpxScalarFieldKeys,
  gpxImportBoatName,
  nearestTrackPointTime,
  parseGpx,
  type GpxTrackPoint,
  isLikelyGpxExportFolder,
  mergeGpxRawDocuments,
  parseAndMergeGpx,
  parseGpxRaw,
  readGpxImportFilesFromFileList,
  GpxFolderImportNeededError,
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
    expect(parsed.segments).toHaveLength(1)
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
    expect(gpxImportBoatName({ name: null, points: parsed.points, segments: parsed.segments, waypoints: [], routeOnly: false, hasTrkData: true }, 'sunset.gpx')).toBe(
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
      extensions: {},
    }))
    const sampled = downsampleGpxPoints(points, 4)
    expect(sampled).toHaveLength(4)
    expect(sampled[0]).toEqual(points[0])
    expect(sampled[sampled.length - 1]).toEqual(points[points.length - 1])
  })

  it('downsamples each segment proportionally', () => {
    const segments = [
      {
        trackName: 'A',
        points: Array.from({ length: 100 }, (_, index) => ({
          latitude: 59,
          longitude: 10 + index * 0.001,
          time: new Date(Date.parse('2026-06-01T09:00:00Z') + index * 60_000).toISOString(),
          elevationM: null,
          heading: null,
          extensions: {},
        })),
      },
      {
        trackName: 'B',
        points: Array.from({ length: 20 }, (_, index) => ({
          latitude: 60,
          longitude: 11 + index * 0.001,
          time: new Date(Date.parse('2026-06-02T09:00:00Z') + index * 60_000).toISOString(),
          elevationM: null,
          heading: null,
          extensions: {},
        })),
      },
    ]

    const sampled = downsampleGpxSegments(segments, 40)
    const total = sampled.reduce((sum, segment) => sum + segment.points.length, 0)
    expect(total).toBeLessThanOrEqual(40)
    expect(sampled[0]?.points[0]).toEqual(segments[0]?.points[0])
    expect(sampled[1]?.points.at(-1)).toEqual(segments[1]?.points.at(-1))
  })

  it('rejects files without points', () => {
    expect(() =>
      parseGpx('<gpx version="1.1"><metadata><name>Empty</name></metadata></gpx>'),
    ).toThrow(/No track points/)
  })

  it('keeps duplicate timestamps in document order within a segment', () => {
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

  it('sorts out-of-order timestamps chronologically within a segment', () => {
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

  it('parses elevation, speed, and Garmin extension fields', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk><trkseg>
    <trkpt lat="59.91" lon="10.75">
      <ele>12.5</ele>
      <time>2026-06-01T09:00:00Z</time>
      <speed>2.57222</speed>
      <extensions>
        <gpxtpx:TrackPointExtension>
          <gpxtpx:hr>120</gpxtpx:hr>
          <gpxtpx:cad>85</gpxtpx:cad>
        </gpxtpx:TrackPointExtension>
      </extensions>
    </trkpt>
    <trkpt lat="59.92" lon="10.76">
      <ele>13.0</ele>
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

    const parsed = parseGpx(gpx)
    expect(parsed.points[0]?.elevationM).toBe(12.5)
    expect(parsed.points[0]?.extensions.speed).toBeCloseTo(2.57222, 4)
    expect(parsed.points[0]?.extensions.hr).toBe(120)
    expect(parsed.points[0]?.extensions.cad).toBe(85)
    expect(discoverGpxScalarFieldKeys(parsed.points)).toEqual(['hr'])
  })

  it('parses multiple trkseg segments and standalone waypoints', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OpenCPN">
  <wpt lat="59.9000" lon="10.7400">
    <name>Harbour</name>
    <desc>Overnight stop</desc>
    <sym>Anchor</sym>
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

    const parsed = parseGpx(gpx)
    expect(parsed.segments).toHaveLength(2)
    expect(parsed.segments[0]?.points).toHaveLength(2)
    expect(parsed.segments[1]?.points).toHaveLength(2)
    expect(parsed.waypoints).toHaveLength(1)
    expect(parsed.waypoints[0]).toMatchObject({
      name: 'Harbour',
      description: 'Overnight stop',
      symbol: 'Anchor',
    })
    expect(parsed.points).toHaveLength(4)
    expect(parsed.routeOnly).toBe(false)
  })

  it('finds nearest track point time for timeless waypoints', () => {
    const points: GpxTrackPoint[] = [
      {
        latitude: 59.91,
        longitude: 10.75,
        time: '2026-06-01T09:00:00.000Z',
        elevationM: null,
        heading: null,
        extensions: {},
      },
      {
        latitude: 59.94,
        longitude: 10.78,
        time: '2026-06-01T12:00:00.000Z',
        elevationM: null,
        heading: null,
        extensions: {},
      },
    ]

    expect(nearestTrackPointTime(points, 59.915, 10.755)).toBe('2026-06-01T09:00:00.000Z')
    expect(nearestTrackPointTime(points, 59.939, 10.779)).toBe('2026-06-01T12:00:00.000Z')
  })

  it('flattens multiple tracks into one ordered trip', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OpenCPN">
  <trk><name>Morning</name><trkseg>
    <trkpt lat="59.91" lon="10.75"><time>2026-06-01T09:00:00Z</time></trkpt>
  </trkseg></trk>
  <trk><name>Afternoon</name><trkseg>
    <trkpt lat="59.92" lon="10.76"><time>2026-06-01T14:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`

    const parsed = parseGpx(gpx)
    expect(parsed.segments).toHaveLength(2)
    expect(parsed.segments[0]?.trackName).toBe('Morning')
    expect(parsed.segments[1]?.trackName).toBe('Afternoon')
    expect(parsed.points.map((point) => point.latitude)).toEqual([59.91, 59.92])
  })

  it('rejects marks-only GPX with a helpful OpenCPN message', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OpenCPN">
  <wpt lat="59.9000" lon="10.7400"><name>Harbour</name></wpt>
  <wpt lat="59.9100" lon="10.7500"><name>Anchorage</name></wpt>
</gpx>`

    expect(() => parseGpx(gpx)).toThrow(/marks or waypoints/i)
  })

  it('merges OpenCPN tracks and marks GPX files into one trip', () => {
    const tracksGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OpenCPN">
  <trk><name>Day sail</name><trkseg>
    <trkpt lat="59.9100" lon="10.7500"><time>2026-06-01T09:00:00Z</time></trkpt>
    <trkpt lat="59.9200" lon="10.7600"><time>2026-06-01T12:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`
    const marksGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OpenCPN">
  <wpt lat="59.9000" lon="10.7400"><name>Harbour</name><desc>Departure</desc></wpt>
  <wpt lat="59.9300" lon="10.7700"><name>Destination</name></wpt>
</gpx>`

    const parsed = parseAndMergeGpx([
      { gpxXml: tracksGpx, fileName: 'tracks.gpx' },
      { gpxXml: marksGpx, fileName: 'marks.gpx' },
    ])

    expect(parsed.hasTrkData).toBe(true)
    expect(parsed.points).toHaveLength(2)
    expect(parsed.waypoints).toHaveLength(2)
    expect(parsed.waypoints[0]?.name).toBe('Harbour')
  })

  it('mergeGpxRawDocuments combines track segments from multiple files', () => {
    const merged = mergeGpxRawDocuments([
      parseGpxRaw(`<gpx><trk><name>A</name><trkseg>
        <trkpt lat="1" lon="1"><time>2026-01-01T09:00:00Z</time></trkpt>
      </trkseg></trk></gpx>`),
      parseGpxRaw(`<gpx><trk><name>B</name><trkseg>
        <trkpt lat="2" lon="2"><time>2026-01-01T10:00:00Z</time></trkpt>
      </trkseg></trk></gpx>`),
    ])

    expect(merged.segments).toHaveLength(2)
    expect(merged.points).toHaveLength(2)
  })

  it('detects OpenCPN export folders named like Trip.gpx', () => {
    expect(
      isLikelyGpxExportFolder({
        name: 'Harbour sail.gpx',
        size: 0,
        type: '',
      }),
    ).toBe(true)
    expect(
      isLikelyGpxExportFolder({
        name: 'tracks.gpx',
        size: 128,
        type: 'application/gpx+xml',
      }),
    ).toBe(false)
  })

  it('requests a folder picker when a .gpx folder is selected as a file', async () => {
    const folderEntry = new File([], 'Harbour sail.gpx', { type: '' })
    await expect(readGpxImportFilesFromFileList([folderEntry])).rejects.toBeInstanceOf(
      GpxFolderImportNeededError,
    )
  })

  it('decodes XML entities in waypoint names and descriptions', () => {
    expect(decodeXmlText('Harbour&apos;s mouth')).toBe("Harbour's mouth")
    expect(decodeXmlText('Line one&#x0A;Line two')).toBe('Line one\nLine two')
    expect(decodeXmlText('&amp;apos;')).toBe("'")
  })

  it('parses encoded OpenCPN waypoint text', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OpenCPN">
  <trk><name>Day&apos;s sail</name><trkseg>
    <trkpt lat="59.91" lon="10.75"><time>2026-06-01T09:00:00Z</time></trkpt>
    <trkpt lat="59.92" lon="10.76"><time>2026-06-01T10:00:00Z</time></trkpt>
  </trkseg></trk>
  <wpt lat="59.9000" lon="10.7400">
    <name>Harbour&apos;s entrance</name>
    <desc>Notes&#x0A;Second line</desc>
  </wpt>
</gpx>`

    const parsed = parseGpx(gpx)
    expect(parsed.name).toBe("Day's sail")
    expect(parsed.waypoints[0]?.name).toBe("Harbour's entrance")
    expect(parsed.waypoints[0]?.description).toBe('Notes\nSecond line')
  })
})
