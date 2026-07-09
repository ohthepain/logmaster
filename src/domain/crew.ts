export type CrewInviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'

export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED'

export type CrewUserSummary = {
  id: string
  name: string
  email: string
  image: string | null
}

export type CrewMemberPendingInvite = {
  id: string
  inviteeEmail: string
  expiresAt: string
}

export type CrewMember = {
  id: string
  ownerUserId: string
  linkedUserId: string | null
  name: string
  email: string | null
  imageUrl: string | null
  isLinked: boolean
  isFriend: boolean
  pendingInvite: CrewMemberPendingInvite | null
  createdAt: string
  updatedAt: string
}

export type CrewInvite = {
  id: string
  crewMemberId: string
  crewMemberName: string
  inviteeEmail: string
  status: CrewInviteStatus
  expiresAt: string
  createdAt: string
  updatedAt: string
}

export type IncomingCrewInvite = CrewInvite & {
  token: string
  inviter: CrewUserSummary
}

export type FriendRequest = {
  id: string
  status: FriendRequestStatus
  requester: CrewUserSummary
  addressee: CrewUserSummary
  createdAt: string
  updatedAt: string
}

export type CrewPayload = {
  members: CrewMember[]
  friends: CrewUserSummary[]
  incomingCrewInvites: IncomingCrewInvite[]
  incomingFriendRequests: FriendRequest[]
}

export type CrewInvitePreview = {
  inviterName: string
  inviteeEmail: string
  crewMemberName: string
  status: CrewInviteStatus
  expired: boolean
}
