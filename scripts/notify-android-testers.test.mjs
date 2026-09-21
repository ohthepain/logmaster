import { describe, expect, it, vi } from 'vitest'
import { notificationConfig, notifyTesters } from './notify-android-testers.mjs'

const env = {
  ANDROID_TESTER_EMAILS: 'one@example.com, TWO@example.com\none@example.com',
  ANDROID_RELEASE_LABEL: '1.0 (build 2)',
  ANDROID_TESTING_URL: 'https://play.google.com/apps/testing/live.logmaster.app',
  AWS_SES_FROM_EMAIL: 'Logmaster <test@example.com>',
}

describe('Android tester notification', () => {
  it('deduplicates recipients and defaults to a preview without calling SES', async () => {
    const send = vi.fn()
    const config = notificationConfig(env)
    expect(config.recipients).toEqual(['one@example.com', 'two@example.com'])
    expect(await notifyTesters(config, send)).toMatchObject({ dryRun: true, accepted: 0 })
    expect(send).not.toHaveBeenCalled()
  })
  it('rejects unavailable releases, wrong links and missing recipients before sending', () => {
    expect(() => notificationConfig({ ...env, NOTIFY_DRY_RUN: 'false' })).toThrow(/available/)
    expect(() => notificationConfig({ ...env, ANDROID_TESTING_URL: 'https://example.com' })).toThrow(/opt-in/)
    expect(() => notificationConfig({ ...env, ANDROID_TESTER_EMAILS: '' })).toThrow(/email/)
  })
  it('sends separately, counts failures, and never retries uncertain sends', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('private provider error')).mockResolvedValueOnce({})
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const config = notificationConfig({ ...env, NOTIFY_DRY_RUN: 'false', ANDROID_RELEASE_AVAILABLE: 'true' })
      expect(await notifyTesters(config, send)).toMatchObject({ accepted: 1, failed: 1 })
      expect(send).toHaveBeenCalledTimes(2)
      expect(send.mock.calls[0][0].Destination).toEqual({ ToAddresses: ['one@example.com'] })
      expect(send.mock.calls[1][0].Destination).toEqual({ ToAddresses: ['two@example.com'] })
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/private provider|example.com/)
    } finally {
      log.mockRestore()
    }
  })
})
