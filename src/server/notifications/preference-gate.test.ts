import { describe, expect, it, vi, beforeEach } from 'vitest'
import { pathsForActivityEvent } from '../../domain/notification-preferences'

const findMany = vi.fn()

vi.mock('../db', () => ({
  prisma: {
    notificationPreferenceMute: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}))

describe('filterUsersNotBlockedByMutes', () => {
  beforeEach(() => {
    findMany.mockReset()
  })

  it('drops users with a mute on the event chain', async () => {
    findMany.mockResolvedValue([{ userId: 'u2' }])
    const { filterUsersNotBlockedByMutes } = await import('./preference-gate')
    const chain = pathsForActivityEvent({
      topic: 'ORG_DOCUMENTS',
      orgId: 'org-1',
    })
    const result = await filterUsersNotBlockedByMutes(
      ['u1', 'u2', 'u3'],
      chain,
    )
    expect(result).toEqual(['u1', 'u3'])
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { in: ['u1', 'u2', 'u3'] },
          path: { in: chain },
          muted: true,
        }),
      }),
    )
  })
})
