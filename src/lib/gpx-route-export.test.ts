import { describe, expect, it } from 'vitest'
import type { Route, RouteWaypoint } from '../domain/route'
import { buildRouteFromGpxFile } from './gpx-route-import'
import { buildRouteGpx } from './gpx-route-export'
import { parseGpxRoute } from './gpx-import'

const route: Route = {
  id: 'route-1',
  title: 'Harbour hop',
  description: 'Short hop between marinas',
  boatId: null,
  coverKind: 'map',
  coverPhotoDataUrl: null,
  source: 'gpx-import',
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-01T08:00:00.000Z',
  synced: false,
}

const waypoints: RouteWaypoint[] = [
  {
    id: 'wp-1',
    routeId: route.id,
    sequence: 0,
    name: 'Start',
    description: null,
    symbol: null,
    latitude: 59.9139,
    longitude: 10.7522,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
    synced: false,
  },
  {
    id: 'wp-2',
    routeId: route.id,
    sequence: 1,
    name: 'Finish',
    description: 'End point',
    symbol: 'Flag',
    latitude: 59.92,
    longitude: 10.76,
    createdAt: '2026-06-01T08:01:00.000Z',
    updatedAt: '2026-06-01T08:01:00.000Z',
    synced: false,
  },
]

describe('gpx-route-export', () => {
  it('builds GPX that round-trips through the route importer', () => {
    const gpx = buildRouteGpx(route, waypoints)
    const parsed = parseGpxRoute(gpx)

    expect(parsed.name).toBe('Harbour hop')
    expect(parsed.fromRte).toBe(true)
    expect(parsed.waypoints).toHaveLength(2)
    expect(parsed.waypoints[0]).toMatchObject({
      name: 'Start',
      latitude: 59.9139,
      longitude: 10.7522,
    })
    expect(parsed.waypoints[1]).toMatchObject({
      name: 'Finish',
      description: 'End point',
      symbol: 'Flag',
    })
  })

  it('round-trips NYC-style waypoints-only exports', () => {
    const { route: importedRoute, waypoints: importedWaypoints } = buildRouteFromGpxFile({
      gpxXml: `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MergeTool" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="40.7484" lon="-73.9857"><name>Empire State Building</name></wpt>
  <wpt lat="40.7580" lon="-73.9855"><name>Times Square</name></wpt>
</gpx>`,
      fileName: 'sample-waypoints-nyc.gpx',
    })

    const exported = buildRouteGpx(importedRoute, importedWaypoints)
    const parsed = parseGpxRoute(exported)

    expect(parsed.waypoints).toHaveLength(2)
    expect(parsed.waypoints.map((waypoint) => waypoint.name)).toEqual([
      'Empire State Building',
      'Times Square',
    ])
  })

  it('throws when there are no waypoints', () => {
    expect(() => buildRouteGpx(route, [])).toThrow(/no waypoints/i)
  })
})
