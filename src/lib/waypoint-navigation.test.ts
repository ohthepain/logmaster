import { describe, expect, it } from 'vitest'
import { resolveActiveWaypointIndex } from './waypoint-navigation'

describe('resolveActiveWaypointIndex', () => {
  const waypoints = [
    { id: 'a', sequence: 0, latitude: 0, longitude: 0, name: 'A' },
    { id: 'b', sequence: 1, latitude: 0, longitude: 1, name: 'B' },
    { id: 'c', sequence: 2, latitude: 0, longitude: 2, name: 'C' },
  ]

  it('returns first waypoint when boat position is unknown', () => {
    expect(resolveActiveWaypointIndex(waypoints, null)).toBe(0)
  })

  it('returns next waypoint after boat position along route', () => {
    expect(
      resolveActiveWaypointIndex(waypoints, { latitude: 0, longitude: 0.4 }),
    ).toBe(1)
  })
})
