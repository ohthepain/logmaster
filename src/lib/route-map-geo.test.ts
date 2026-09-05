import { describe, expect, it } from 'vitest'
import { buildRouteWaypointPointsGeoJson } from './route-map-geo'
import { routeWaypointIconKind } from './route-map-marker'

describe('routeWaypointIconKind', () => {
  it('uses a start flag for a single waypoint', () => {
    expect(routeWaypointIconKind(0, 1)).toBe('waypoint-start')
  })

  it('uses start and finish for two waypoints', () => {
    expect(routeWaypointIconKind(0, 2)).toBe('waypoint-start')
    expect(routeWaypointIconKind(1, 2)).toBe('waypoint-finish')
  })

  it('uses square cross for middle waypoints', () => {
    expect(routeWaypointIconKind(0, 4)).toBe('waypoint-start')
    expect(routeWaypointIconKind(1, 4)).toBe('waypoint')
    expect(routeWaypointIconKind(2, 4)).toBe('waypoint')
    expect(routeWaypointIconKind(3, 4)).toBe('waypoint-finish')
  })
})

describe('buildRouteWaypointPointsGeoJson', () => {
  it('assigns start, middle, and finish marker kinds', () => {
    const waypoints = [0, 1, 2].map((sequence) => ({
      id: `wp-${sequence}`,
      routeId: 'route-1',
      sequence,
      name: `Waypoint ${sequence + 1}`,
      description: null,
      symbol: null,
      latitude: 59.9 + sequence * 0.01,
      longitude: 10.7 + sequence * 0.01,
      createdAt: '2026-06-01T08:00:00.000Z',
      updatedAt: '2026-06-01T08:00:00.000Z',
      synced: false,
    }))

    const geoJson = buildRouteWaypointPointsGeoJson(waypoints)
    expect(geoJson.features.map((feature) => feature.properties.kind)).toEqual([
      'waypoint-start',
      'waypoint',
      'waypoint-finish',
    ])
  })
})
