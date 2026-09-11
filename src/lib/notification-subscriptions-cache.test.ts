import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getNotificationSubscriptionsCached,
  invalidateNotificationSubscriptions,
  notificationSubscriptionScopeKey,
} from './notification-subscriptions-cache'

import { fetchNotificationSubscriptions } from './notifications-api'

vi.mock('./notifications-api', () => ({
  fetchNotificationSubscriptions: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchNotificationSubscriptions)

afterEach(() => {
  vi.clearAllMocks()
  invalidateNotificationSubscriptions()
})

describe('notification-subscriptions-cache', () => {
  it('builds stable scope keys', () => {
    expect(notificationSubscriptionScopeKey({ boatId: 'b1' })).toBe('boat:b1')
    expect(notificationSubscriptionScopeKey({ orgId: 'o1' })).toBe('org:o1')
    expect(notificationSubscriptionScopeKey({ global: true })).toBe(
      'global:admin',
    )
  })

  it('dedupes concurrent fetches for the same boat scope', async () => {
    mockedFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve([
                {
                  id: '1',
                  userId: 'u1',
                  topic: 'BOAT_PHOTOS',
                  scopeKey: 'boat:b1:BOAT_PHOTOS',
                  enabled: true,
                  boatId: 'b1',
                  orgId: null,
                  emailEnabled: false,
                  pushEnabled: false,
                  createdAt: '2026-01-01T00:00:00.000Z',
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ]),
            10,
          )
        }),
    )

    const [a, b] = await Promise.all([
      getNotificationSubscriptionsCached({ boatId: 'b1' }),
      getNotificationSubscriptionsCached({ boatId: 'b1' }),
    ])

    expect(a).toEqual(b)
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it('returns cached data within stale window', async () => {
    mockedFetch.mockResolvedValue([])

    await getNotificationSubscriptionsCached({ boatId: 'b1' })
    await getNotificationSubscriptionsCached({ boatId: 'b1' })

    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })
})
