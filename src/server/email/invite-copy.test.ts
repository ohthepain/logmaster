import { describe, expect, it } from 'vitest'
import {
  buildConnectionInviteEmail,
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

  it('builds a connection invite with a button and no visible raw link', () => {
    const url =
      'https://logmaster.live/connections/invite/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const email = buildConnectionInviteEmail({
      appName: 'logmaster',
      inviterName: 'Paul <script>',
      url,
    })
    expect(email.subject).toBe(
      'Paul <script> invited you to connect on logmaster',
    )
    expect(email.html).toContain('Connect with Paul &lt;script&gt;')
    expect(email.html).toContain('What to do:')
    expect(email.html).toContain('Accept invitation')
    expect(email.html).toContain('viewport')
    expect(email.html).toContain(`href="${url}"`)
    const withoutLinks = email.html.replace(/href="[^"]*"/g, '')
    expect(withoutLinks).not.toContain(url)
    expect(email.text).toContain(url)
    expect(email.text).toContain('create one with this email address')
    expect(email.locale).toBe('en')
  })

  it('localizes a connection invite', () => {
    const sv = buildConnectionInviteEmail({
      locale: 'sv',
      appName: 'logmaster',
      inviterName: 'Paul',
      url: 'https://example.com/invite/abc',
    })
    expect(sv.locale).toBe('sv')
    expect(sv.subject).toContain('Paul')
    expect(sv.html).toContain('lang="sv"')
    expect(sv.html).toContain('Acceptera inbjudan')
    expect(sv.html).not.toContain('Accept invitation')
    const ar = buildConnectionInviteEmail({
      locale: 'ar',
      appName: 'logmaster',
      inviterName: 'Sam',
      url: 'https://example.com/invite/abc',
    })
    expect(ar.html).toContain('dir="rtl"')
    expect(ar.html).toContain('قبول الدعوة')
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
