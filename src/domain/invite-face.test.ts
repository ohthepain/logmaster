import { expect, it } from 'vitest'
import {
  connectionFormedLabel,
  inviteSignupFocused,
  referralIntroLabel,
} from './invite-face'

it('focuses signup only while the invited email is unchanged', () => {
  const face = { valid: true, email: 'Sam@example.com' }
  expect(inviteSignupFocused(face, 'sam@example.com')).toBe(true)
  expect(inviteSignupFocused(face, 'other@example.com')).toBe(false)
  expect(
    inviteSignupFocused(
      { valid: false, email: 'sam@example.com' },
      'sam@example.com',
    ),
  ).toBe(false)
})

it('names the other person in the connection line', () => {
  const event = {
    inviterId: 'inviter',
    inviterName: 'Paul',
    inviteeName: 'Sam',
  }
  expect(connectionFormedLabel(event, 'inviter')).toBe(
    'You and Sam are connected',
  )
  expect(connectionFormedLabel(event, 'invitee')).toBe(
    'You and Paul are connected',
  )
})

it('explains the referral from each side', () => {
  const event = {
    inviterId: 'inviter',
    inviteeId: 'invitee',
    inviterName: 'Paul',
    inviteeName: 'Sam',
    limit: 100,
  }
  expect(referralIntroLabel(event, 'inviter')).toContain('When Sam spends')
  expect(referralIntroLabel(event, 'invitee')).toContain('Paul receives')
})
