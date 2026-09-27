import { REFERRAL_LIMIT } from './doubloons'

export type InviteFaceIcon = {
  name: string
  imageUrl: string | null
}

export type InviteFace = {
  kind: 'boat' | 'crew' | 'org' | 'connection'
  valid: boolean
  email: string | null
  message: string
  hero: InviteFaceIcon | null
  people: InviteFaceIcon[]
  boats: InviteFaceIcon[]
}

export function inviteSignupFocused(
  face: { valid: boolean; email: string | null } | null,
  email: string,
) {
  if (!face?.valid || !face.email) return false
  return face.email.trim().toLowerCase() === email.trim().toLowerCase()
}

export function boatInviteMessage(boatName: string) {
  return `You have been invited to join ${boatName}`
}

export function crewInviteMessage(inviterName: string) {
  return `You have been invited to join a crew with ${inviterName}`
}

export function orgInviteMessage(orgName: string) {
  return `You have been invited to join ${orgName}`
}

export function connectionInviteMessage(inviterName: string) {
  return `${inviterName} wants to connect`
}

export function connectionFormedLabel(
  event: { inviterId: string; inviteeName: string; inviterName: string },
  viewerId: string,
) {
  const other =
    viewerId === event.inviterId ? event.inviteeName : event.inviterName
  return `You and ${other} are connected`
}

export function referralIntroLabel(
  event: {
    inviterId: string
    inviteeId: string
    inviterName: string
    inviteeName: string
    limit: number
  },
  viewerId: string,
) {
  if (viewerId === event.inviteeId) {
    return `When you spend doubloons on sailing, ${event.inviterName} receives the same amount, up to ${event.limit} doubloons.`
  }
  return `When ${event.inviteeName} spends doubloons on sailing, you receive the same amount, up to ${event.limit} doubloons.`
}

export function referralIntroEvent(args: {
  inviterId: string
  inviteeId: string
  inviterName: string
  inviteeName: string
}) {
  return {
    type: 'referral_intro' as const,
    version: 1 as const,
    ...args,
    limit: REFERRAL_LIMIT,
  }
}
