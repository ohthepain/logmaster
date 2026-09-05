import { describe, expect, it } from 'vitest'
import type { RouteWaypoint } from '../domain/route'
import {
  applyInsertSequence,
  copyWaypointsToRoute,
  insertSequenceAfter,
  normalizeWaypointSequences,
  reorderWaypointsByIds,
  resequenceWaypoints,
  routeWaypointsToTripEntries,
} from './route-waypoint-ops'

function waypoint(
  id: string,
  sequence: number,
  lat = 59 + sequence * 0.01,
  lon = 18 + sequence * 0.01,
): RouteWaypoint {
  return {
    id,
    routeId: 'route-1',
    sequence,
    name: `WP ${sequence + 1}`,
    description: null,
    symbol: null,
    latitude: lat,
    longitude: lon,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    synced: false,
  }
}

describe('resequenceWaypoints', () => {
  it('normalizes sequences to 0..n-1 preserving order', () => {
    const result = resequenceWaypoints([waypoint('c', 5), waypoint('a', 1), waypoint('b', 3)])
    expect(result.map((item) => [item.id, item.sequence])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ])
  })
})

describe('normalizeWaypointSequences', () => {
  it('sorts by sequence then renumbers', () => {
    const result = normalizeWaypointSequences([waypoint('c', 5), waypoint('a', 1), waypoint('b', 3)])
    expect(result.map((item) => item.sequence)).toEqual([0, 1, 2])
    expect(result.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('insertSequenceAfter', () => {
  it('appends when insertAfterSequence is omitted', () => {
    expect(insertSequenceAfter([waypoint('a', 0), waypoint('b', 1)])).toBe(2)
  })

  it('inserts after the given sequence', () => {
    expect(insertSequenceAfter([waypoint('a', 0), waypoint('b', 1)], 0)).toBe(1)
  })
})

describe('applyInsertSequence', () => {
  it('bumps later sequences and re-normalizes', () => {
    const result = applyInsertSequence(
      [waypoint('a', 0), waypoint('b', 1), waypoint('c', 2)],
      1,
    )
    expect(result.map((item) => [item.id, item.sequence])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ])
  })
})

describe('copyWaypointsToRoute', () => {
  it('clones with new ids and target route id', () => {
    const source = [waypoint('a', 0), waypoint('b', 1)]
    const copied = copyWaypointsToRoute(source, 'route-2', 3)
    expect(copied).toHaveLength(2)
    expect(copied[0]?.routeId).toBe('route-2')
    expect(copied[0]?.id).not.toBe('a')
    expect(copied.map((item) => item.sequence)).toEqual([3, 4])
  })
})

describe('routeWaypointsToTripEntries', () => {
  it('builds NOTE entries with waypoint flag', () => {
    const entries = routeWaypointsToTripEntries([waypoint('a', 0)], 'trip-1')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.type).toBe('NOTE')
    expect(entries[0]?.data?.waypoint).toBe(true)
    expect(entries[0]?.data?.source).toBe('route-copy')
  })

  it('dedupes by coordinates against existing entries', () => {
    const entries = routeWaypointsToTripEntries([waypoint('a', 0, 59, 18)], 'trip-1', {
      existingEntries: [
        {
          id: 'existing',
          tripId: 'trip-1',
          type: 'NOTE',
          timestamp: '2026-01-01T00:00:00.000Z',
          latitude: 59,
          longitude: 18,
          accuracy: null,
          heading: null,
          createdBy: null,
          notes: null,
          data: null,
          weather: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          synced: false,
          deleted: false,
          legId: null,
        },
      ],
    })
    expect(entries).toHaveLength(0)
  })
})

describe('reorderWaypointsByIds', () => {
  it('reorders and resequences by id list', () => {
    const result = reorderWaypointsByIds(
      [waypoint('a', 0), waypoint('b', 1), waypoint('c', 2)],
      ['c', 'a', 'b'],
    )
    expect(result.map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(result.map((item) => item.sequence)).toEqual([0, 1, 2])
  })
})
