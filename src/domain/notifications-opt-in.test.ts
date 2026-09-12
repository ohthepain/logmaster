import { describe, expect, it } from 'vitest'
import { isNotificationTopicEnabled } from './notifications'

describe('isNotificationTopicEnabled', () => {
  it('opts in when there is no subscription row', () => {
    expect(isNotificationTopicEnabled(null)).toBe(true)
    expect(isNotificationTopicEnabled(undefined)).toBe(true)
  })

  it('follows an explicit subscription', () => {
    expect(isNotificationTopicEnabled({ enabled: true })).toBe(true)
    expect(isNotificationTopicEnabled({ enabled: false })).toBe(false)
  })
})
