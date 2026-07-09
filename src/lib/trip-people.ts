import type { CrewMember } from '../domain/crew'
import { profilePhotoUrl } from './profile-api'

export type TripPersonKind = 'user' | 'crew'

export type TripPersonOption = {
  key: string
  kind: TripPersonKind
  id: string
  name: string
  imageUrl: string | null
  linkedUserId?: string | null
}

export function userTripPersonKey(userId: string) {
  return `user:${userId}`
}

export function crewTripPersonKey(crewMemberId: string) {
  return `crew:${crewMemberId}`
}

export function parseTripPersonKey(key: string): { kind: TripPersonKind; id: string } | null {
  const [kind, id] = key.split(':')
  if ((kind !== 'user' && kind !== 'crew') || !id) return null
  return { kind, id }
}

export function buildSkipperOptions(args: {
  userId: string
  userName: string
  userImage: string | null | undefined
  crewMembers: CrewMember[]
}): TripPersonOption[] {
  const self: TripPersonOption = {
    key: userTripPersonKey(args.userId),
    kind: 'user',
    id: args.userId,
    name: args.userName || 'You',
    imageUrl: profilePhotoUrl(args.userImage),
  }

  const crew = args.crewMembers.map((member): TripPersonOption => ({
    key: crewTripPersonKey(member.id),
    kind: 'crew',
    id: member.id,
    name: member.name,
    imageUrl: member.imageUrl,
    linkedUserId: member.linkedUserId,
  }))

  return [self, ...crew]
}

export function resolveTripPersonOption(
  key: string | null | undefined,
  options: TripPersonOption[],
): TripPersonOption | null {
  if (!key) return null
  return options.find((option) => option.key === key) ?? null
}
