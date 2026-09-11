import { describe, expect, it } from 'vitest'
import {
  ancestorChainForPath,
  computePathMuteState,
  enrichPreferencePathLabel,
  isBlockedByMute,
  listPathsForPreferencesTree,
  partitionTripsForNotificationSettings,
  pathsForActivityEvent,
  preferencePathForSubscription,
} from './notification-preferences'
import type { Trip } from './logbook'

describe('notification preference paths', () => {
  it('builds boat photo event chain', () => {
    expect(
      pathsForActivityEvent({
        topic: 'BOAT_PHOTOS',
        boatId: 'b1',
      }),
    ).toEqual(['global', 'boat', 'boat:b1', 'boat:b1:photos'])
  })

  it('builds org member event chain', () => {
    expect(
      pathsForActivityEvent({
        topic: 'ORG_MEMBERS',
        orgId: 'o1',
      }),
    ).toEqual(['global', 'org', 'org:o1', 'org:o1:members'])
  })

  it('builds admin job chain', () => {
    expect(
      pathsForActivityEvent({
        topic: 'ADMIN_JOBS',
      }),
    ).toEqual(['global', 'job'])
  })

  it('builds trip-scoped chain when tripId is set', () => {
    expect(
      pathsForActivityEvent({
        topic: 'BOAT_PHOTOS',
        tripId: 't1',
        boatId: 'b1',
      }),
    ).toEqual(['global', 'trip', 'trip:t1', 'trip:t1:photos'])
  })

  it('maps subscription to section path', () => {
    expect(
      preferencePathForSubscription({
        topic: 'BOAT_DOCUMENTS',
        boatId: 'b1',
      }),
    ).toBe('boat:b1:documents')
  })
})

describe('ancestor chains and mute evaluation', () => {
  it('walks ancestors for nested boat section', () => {
    expect(ancestorChainForPath('boat:b1:photos')).toEqual([
      'global',
      'boat',
      'boat:b1',
      'boat:b1:photos',
    ])
  })

  it('blocks when global is muted', () => {
    const muted = new Set(['global'])
    const chain = pathsForActivityEvent({
      topic: 'BOAT_PHOTOS',
      boatId: 'b1',
    })
    expect(isBlockedByMute(muted, chain)).toEqual({
      blocked: true,
      blockedBy: 'global',
    })
  })

  it('reports ineffective child when parent muted', () => {
    const muted = new Set(['boat'])
    const state = computePathMuteState('boat:b1:photos', muted)
    expect(state.effective).toBe(false)
    expect(state.blockedBy).toBe('boat')
    expect(state.muted).toBe(false)
  })
})

describe('preferences tree helpers', () => {
  it('lists paths for full tree', () => {
    const paths = listPathsForPreferencesTree({
      boatIds: ['b1'],
      orgIds: ['o1'],
      tripIds: ['t1'],
      includeJob: false,
    })
    expect(paths).toContain('global')
    expect(paths).toContain('boat:b1:photos')
    expect(paths).toContain('org:o1:members')
    expect(paths).toContain('trip:t1:stories')
    expect(paths).not.toContain('job')
  })

  it('enriches boat and org labels', () => {
    const label = enrichPreferencePathLabel('boat:b1:photos', {
      boats: [{ id: 'b1', name: 'Windward' }],
      orgs: [],
    })
    expect(label).toBe('Windward: Photos')
  })

  it('partitions trips for settings UI', () => {
    const trips = [
      { id: '1', status: 'IN_PROGRESS', boatName: 'A', startedAt: '', createdAt: '', updatedAt: '' },
      { id: '2', status: 'COMPLETED', boatName: 'B', startedAt: '', completedAt: '2026-01-02', createdAt: '', updatedAt: '2026-01-02' },
      { id: '3', status: 'COMPLETED', boatName: 'C', startedAt: '', completedAt: '2026-01-03', createdAt: '', updatedAt: '2026-01-03' },
    ] as Trip[]
    const { inProgress, completed } =
      partitionTripsForNotificationSettings(trips)
    expect(inProgress.map((t) => t.id)).toEqual(['1'])
    expect(completed.map((t) => t.id)).toEqual(['3', '2'])
  })
})
