import type { OrgMemberRole } from './org'

export type MemberInviteKind = 'ORG' | 'BOAT'

export type MemberInvite = {
  id: string
  kind: MemberInviteKind
  orgId: string | null
  boatId: string | null
  inviteeEmail: string | null
  token: string
  role: OrgMemberRole
  status: string
  expiresAt: string
  inviteUrl: string
  createdAt: string
  updatedAt: string
}

export type MemberInvitePreview = {
  kind: MemberInviteKind
  inviterName: string
  inviteeEmail: string | null
  inviteeHasAccount: boolean
  role: OrgMemberRole
  status: string
  expired: boolean
  targetName: string
  targetId: string | null
}

export type ResourceMember = {
  id: string
  userId: string
  contactId?: string | null
  role: OrgMemberRole
  isOwner?: boolean
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

export type InviteMemberResult =
  | { member: ResourceMember; invite?: undefined }
  | { invite: MemberInvite; member?: undefined }

export const MEMBER_ROLE_LABELS: Record<OrgMemberRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}
