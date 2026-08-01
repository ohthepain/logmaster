import { describe, expect, it } from 'vitest'
import type { Leg, LogEntry } from '../domain/logbook'
import {
  defaultLegTitle,
  legDisplayTitle,
  mergeLegs,
  rebuildLegsForTrip,
} from './trip-legs'

function entry(
  partial: Partial<LogEntry> & Pick<LogEntry, 'id' | 'type' | 'timestamp'>,
): LogEntry {
  return {
    tripId: 'trip-1',
    legId: null,
    latitude: null,
    longitude: null,
    accuracy: null,
    heading: null,
    createdBy: null,
    notes: null,
    data: null,
    weather: null,
    createdAt: partial.timestamp,
    updatedAt: partial.timestamp,
    synced: true,
    deleted: false,
    ...partial,
  }
}

describe('rebuildLegsForTrip', () => {
  it('creates a single leg for a simple trip', () => {
    const entries = [
      entry({ id: 'e1', type: 'START_TRIP', timestamp: '2026-01-01T10:00:00Z' }),
      entry({ id: 'e2', type: 'NOTE', timestamp: '2026-01-01T11:00:00Z' }),
    ]
    const { legs, entries: out } = rebuildLegsForTrip('trip-1', entries, [])
    expect(legs).toHaveLength(1)
    expect(out.every((e) => e.legId === legs[0].id)).toBe(true)
  })

  it('starts a new leg on cast off', () => {
    const entries = [
      entry({ id: 'e1', type: 'START_TRIP', timestamp: '2026-01-01T10:00:00Z' }),
      entry({ id: 'e2', type: 'ANCHOR_DROPPED', timestamp: '2026-01-01T12:00:00Z' }),
      entry({ id: 'e3', type: 'CAST_OFF', timestamp: '2026-01-02T08:00:00Z' }),
      entry({ id: 'e4', type: 'NOTE', timestamp: '2026-01-02T09:00:00Z' }),
    ]
    const { legs, entries: out } = rebuildLegsForTrip('trip-1', entries, [])
    expect(legs).toHaveLength(2)
    expect(out.find((e) => e.id === 'e1')?.legId).toBe(legs[0].id)
    expect(out.find((e) => e.id === 'e3')?.legId).toBe(legs[1].id)
    expect(legs[0].endedAt).toBe('2026-01-01T12:00:00Z')
    expect(legs[0].endEventId).toBe('e2')
    expect(legs[1].startEventId).toBe('e3')
  })

  it('starts a new leg on anchor weighed', () => {
    const entries = [
      entry({ id: 'e1', type: 'START_TRIP', timestamp: '2026-01-01T10:00:00Z' }),
      entry({ id: 'e2', type: 'ANCHOR_WEIGHED', timestamp: '2026-01-02T08:00:00Z' }),
    ]
    const { legs } = rebuildLegsForTrip('trip-1', entries, [])
    expect(legs).toHaveLength(2)
  })
})

describe('mergeLegs', () => {
  it('merges adjacent legs and reassigns entries', () => {
    const legs: Leg[] = [
      {
        id: 'leg-1',
        tripId: 'trip-1',
        sequence: 0,
        title: null,
        startEventId: 'e1',
        endEventId: 'e2',
        startedAt: '2026-01-01T10:00:00Z',
        endedAt: '2026-01-02T08:00:00Z',
        createdAt: '2026-01-01T10:00:00Z',
        updatedAt: '2026-01-01T10:00:00Z',
        synced: true,
      },
      {
        id: 'leg-2',
        tripId: 'trip-1',
        sequence: 1,
        title: 'Passage',
        startEventId: 'e3',
        endEventId: null,
        startedAt: '2026-01-02T08:00:00Z',
        endedAt: null,
        createdAt: '2026-01-02T08:00:00Z',
        updatedAt: '2026-01-02T08:00:00Z',
        synced: true,
      },
    ]
    const entries = [
      entry({ id: 'e1', type: 'START_TRIP', timestamp: '2026-01-01T10:00:00Z', legId: 'leg-1' }),
      entry({ id: 'e3', type: 'CAST_OFF', timestamp: '2026-01-02T08:00:00Z', legId: 'leg-2' }),
    ]
    const result = mergeLegs('leg-1', 'leg-2', legs, entries)
    expect(result).not.toBeNull()
    expect(result!.legs.filter((l) => l.tripId === 'trip-1')).toHaveLength(1)
    const mergedId = result!.legs.find((l) => l.tripId === 'trip-1')!.id
    expect(result!.entries.every((e) => e.legId === mergedId)).toBe(true)
  })
})

describe('legDisplayTitle', () => {
  it('uses default when title empty', () => {
    expect(legDisplayTitle({ sequence: 0 } as Leg)).toBe(defaultLegTitle(0))
  })
})
