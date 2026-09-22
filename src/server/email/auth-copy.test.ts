import { describe, expect, it } from 'vitest'
import { buildMagicLinkEmail, buildVerifyEmailEmail } from './auth-copy'

describe('auth email copy', () => {
  it('localizes magic link email', () => {
    const sv = buildMagicLinkEmail({
      locale: 'sv',
      appName: 'logmaster',
      url: 'https://example.com/magic',
    })
    expect(sv.subject).toContain('logmaster')
    expect(sv.html).toContain('lang="sv"')
    expect(sv.html).toContain('Logga in')
  })

  it('localizes verify email', () => {
    const de = buildVerifyEmailEmail({
      locale: 'de',
      appName: 'logmaster',
      url: 'https://example.com/verify',
    })
    expect(de.html).toContain('E-Mail bestätigen')
  })
})
