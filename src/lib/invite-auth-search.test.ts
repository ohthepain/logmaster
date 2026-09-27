import { describe, expect, it } from 'vitest'
import {
  parseInviteFromRedirect,
  signupSkipsEmailVerification,
} from './invite-auth-search'

describe('parseInviteFromRedirect', () => {
  it('recognizes crew, organization, boat, and connection invites', () => {
    expect(parseInviteFromRedirect('/crew/invite/abc')).toEqual({
      kind: 'crew',
      token: 'abc',
    })
    expect(parseInviteFromRedirect('/invite/boat-token')).toEqual({
      kind: 'member',
      token: 'boat-token',
    })
    expect(parseInviteFromRedirect('/connections/invite/conn')).toEqual({
      kind: 'connection',
      token: 'conn',
    })
    expect(parseInviteFromRedirect('/connections')).toBeNull()
  })
})

describe('signupSkipsEmailVerification', () => {
  it('skips verification for a pending email invite or an already verified account', () => {
    expect(
      signupSkipsEmailVerification({
        emailVerified: false,
        pendingInvite: true,
      }),
    ).toBe(true)
    expect(
      signupSkipsEmailVerification({
        emailVerified: true,
        pendingInvite: false,
      }),
    ).toBe(true)
    expect(
      signupSkipsEmailVerification({
        emailVerified: false,
        pendingInvite: false,
      }),
    ).toBe(false)
  })
})
