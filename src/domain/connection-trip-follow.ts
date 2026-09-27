export type ConnectionTripFollow = {
  userLowId: string
  userHighId: string
  requestedByUserId: string
  status: string
  notifyInviteeOnTripStart: boolean
  notifyOnInviterTripStart: boolean
}

/** Invitee to notify when the inviter starts a trip, if both sides opted in. */
export function tripStartRecipientId(
  connection: ConnectionTripFollow,
  starterUserId: string,
): string | null {
  if (connection.status !== 'ACCEPTED') return null
  if (connection.requestedByUserId !== starterUserId) return null
  if (
    !connection.notifyInviteeOnTripStart ||
    !connection.notifyOnInviterTripStart
  )
    return null
  const recipient =
    connection.userLowId === starterUserId
      ? connection.userHighId
      : connection.userHighId === starterUserId
        ? connection.userLowId
        : null
  if (!recipient || recipient === starterUserId) return null
  return recipient
}
