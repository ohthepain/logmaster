import { describe, expect, it } from 'vitest'
import { tripStartRecipientId } from './connection-trip-follow'

const connection = {
  userLowId: 'a',
  userHighId: 'b',
  requestedByUserId: 'a',
  status: 'ACCEPTED',
  notifyInviteeOnTripStart: true,
  notifyOnInviterTripStart: true,
}

describe('tripStartRecipientId', () => {
  it('notifies the invitee when both settings are on and the inviter starts', () => {
    expect(tripStartRecipientId(connection, 'a')).toBe('b')
  })

  it('stays quiet when either setting is off', () => {
    expect(
      tripStartRecipientId(
        { ...connection, notifyInviteeOnTripStart: false },
        'a',
      ),
    ).toBeNull()
    expect(
      tripStartRecipientId(
        { ...connection, notifyOnInviterTripStart: false },
        'a',
      ),
    ).toBeNull()
  })

  it('does not notify the inviter when the invitee starts a trip', () => {
    expect(tripStartRecipientId(connection, 'b')).toBeNull()
  })

  it('ignores pending connections', () => {
    expect(
      tripStartRecipientId({ ...connection, status: 'PENDING' }, 'a'),
    ).toBeNull()
  })
})
