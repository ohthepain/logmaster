import { describe, expect, it } from 'vitest'
import { buildRouteFromGpxFile } from './gpx-route-import'

describe('buildRouteFromGpxFile', () => {
  it('imports NYC-style waypoints-only GPX as a route', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MergeTool" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="40.7484" lon="-73.9857">
    <name>Empire State Building</name>
    <desc>Global cultural icon and architectural masterpiece.</desc>
  </wpt>
  <wpt lat="40.7580" lon="-73.9855">
    <name>Times Square</name>
    <desc>The world's most visited tourist attraction.</desc>
  </wpt>
  <wpt lat="40.7812" lon="-73.9665">
    <name>Central Park South</name>
    <desc>Urban landscape and recreational park.</desc>
  </wpt>
</gpx>`

    const { route, waypoints } = buildRouteFromGpxFile({
      gpxXml: gpx,
      fileName: 'sample-waypoints-nyc.gpx',
    })

    expect(route.title).toBe('Empire State Building')
    expect(route.source).toBe('gpx-import')
    expect(waypoints).toHaveLength(3)
    expect(waypoints.map((waypoint) => waypoint.sequence)).toEqual([0, 1, 2])
    expect(waypoints[1]?.name).toBe('Times Square')
    expect(waypoints[1]?.description).toContain('tourist')
  })
})
