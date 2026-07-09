import { describe, expect, it } from 'vitest'
import {
  passwordResetCallbackUrl,
  passwordResetEmailUrl,
} from './password-reset-url'

describe('passwordResetEmailUrl', () => {
  it('builds the auth API callback URL', () => {
    expect(
      passwordResetEmailUrl({
        origin: 'https://staging.logmaster.live',
        token: 'abc123',
      }),
    ).toBe(
      'https://staging.logmaster.live/api/auth/reset-password/abc123?callbackURL=https%3A%2F%2Fstaging.logmaster.live%2Freset-password',
    )
  })

  it('normalizes trailing slashes on origin', () => {
    expect(passwordResetCallbackUrl('https://staging.logmaster.live/')).toBe(
      'https://staging.logmaster.live/reset-password',
    )
  })
})
