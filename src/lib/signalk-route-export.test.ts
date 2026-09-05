import { describe, expect, it } from 'vitest'
import type { Route, RouteWaypoint } from '../domain/route'
import { buildRouteSignalKExport } from './signalk-route-export'
import { parseSignalKImportJson } from './signalk-import'

const route: Route = {
  id: 'route-1',
  title: 'Coastal plan',
  description: null,
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
    name: 'Waypoint A',
    description: 'First stop',
    symbol: null,
    latitude: 59.9139,
    longitude: 10.7522,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
    synced: false,
  },
]

describe('signalk-route-export', () => {
  it('exports route waypoints in the logmaster envelope', () => {
    const exported = buildRouteSignalKExport(route, waypoints)
    const parsed = JSON.parse(exported) as {
      kind: string
      waypoints: Array<{ name: string }>
      positionTrack: unknown[]
      deltas: unknown[]
    }

    expect(parsed.kind).toBe('route')
    expect(parsed.waypoints).toHaveLength(1)
    expect(parsed.waypoints[0]?.name).toBe('Waypoint A')
    expect(parsed.positionTrack).toEqual([])
    expect(parsed.deltas).toEqual([])
  })

  it('can be parsed by the Signal K importer', () => {
    const exported = buildRouteSignalKExport(route, waypoints)
    const parsed = parseSignalKImportJson(exported)

    expect(parsed.waypoints).toHaveLength(1)
    expect(parsed.waypoints[0]).toMatchObject({
      name: 'Waypoint A',
      latitude: 59.9139,
      longitude: 10.7522,
    })
  })

  it('throws when there are no waypoints', () => {
    expect(() => buildRouteSignalKExport(route, [])).toThrow(/no waypoints/i)
  })
})
