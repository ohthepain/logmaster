import { describe, expect, it } from 'vitest'
import {
  buildCrewInviteEmail,
  buildMemberInviteEmail,
  resolveMemberTargetName,
} from './invite-copy'
import { normalizeInviteLocale } from '../../lib/invite-locale'

describe('normalizeInviteLocale', () => {
  it('accepts supported codes and falls back to English', () => {
    expect(normalizeInviteLocale('sv')).toBe('sv')
    expect(normalizeInviteLocale('zh-HK')).toBe('yue')
    expect(normalizeInviteLocale('not-a-lang')).toBe('en')
  })
})

describe('invite email copy', () => {
  it('localizes member invite subject and body', () => {
    const sv = buildMemberInviteEmail({
      locale: 'sv',
      appName: 'logmaster',
      inviterName: 'Anna',
      targetName: 'Blue Horizon',
      targetKind: 'boat',
      url: 'https://example.com/invite/abc',
    })
    expect(sv.locale).toBe('sv')
    expect(sv.subject).toContain('Anna')
    expect(sv.subject).toContain('Blue Horizon')
    expect(sv.html).toContain('Acceptera inbjudan')
    expect(sv.html).toContain('lang="sv"')
    expect(sv.html).toContain('https://example.com/invite/abc')
  })

  it('uses translated fallbacks when target name is missing', () => {
    expect(
      resolveMemberTargetName({
        locale: 'de',
        targetName: null,
        targetKind: 'org',
      }),
    ).toBe('eine Organisation')
  })

  it('builds crew invite with rtl layout for Arabic', () => {
    const ar = buildCrewInviteEmail({
      locale: 'ar',
      appName: 'logmaster',
      inviterName: 'Sam',
      url: 'https://example.com/crew/abc',
    })
    expect(ar.html).toContain('dir="rtl"')
    expect(ar.html).toContain('lang="ar"')
  })
})
