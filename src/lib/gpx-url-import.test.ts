import { describe, expect, it } from 'vitest'
import {
  gpxFileNameFromUrl,
  normalizeGpxImportUrl,
} from './gpx-url-import'

describe('gpx-url-import', () => {
  it('derives a file name from the URL path', () => {
    expect(gpxFileNameFromUrl('https://example.com/tracks/day-sail.gpx')).toBe('day-sail.gpx')
    expect(gpxFileNameFromUrl('https://example.com/tracks/day-sail')).toBe('day-sail.gpx')
    expect(gpxFileNameFromUrl('not-a-url')).toBe('imported.gpx')
  })

  it('normalizes GitHub blob and raw page links to raw.githubusercontent.com', () => {
    expect(
      normalizeGpxImportUrl(
        'https://github.com/kirienko/gpx-player/blob/main/example-data/osm-demo-Alex.gpx',
      ),
    ).toBe(
      'https://raw.githubusercontent.com/kirienko/gpx-player/main/example-data/osm-demo-Alex.gpx',
    )
    expect(
      normalizeGpxImportUrl(
        'https://github.com/kirienko/gpx-player/raw/main/example-data/osm-demo-Alex.gpx',
      ),
    ).toBe(
      'https://raw.githubusercontent.com/kirienko/gpx-player/main/example-data/osm-demo-Alex.gpx',
    )
  })

  it('leaves direct download URLs unchanged', () => {
    const direct =
      'https://raw.githubusercontent.com/kirienko/gpx-player/main/example-data/osm-demo-Alex.gpx'
    expect(normalizeGpxImportUrl(direct)).toBe(direct)
    expect(
      normalizeGpxImportUrl('https://example.com/tracks/day-sail.gpx'),
    ).toBe('https://example.com/tracks/day-sail.gpx')
  })
})
