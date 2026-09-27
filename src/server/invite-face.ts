import type { InviteFace, InviteFaceIcon } from '../domain/invite-face'
import {
  boatInviteMessage,
  connectionInviteMessage,
  crewInviteMessage,
  orgInviteMessage,
} from '../domain/invite-face'
import { prisma } from './db'
import { getPhotoObject, profilePhotoS3Key } from './s3-photos'
import {
  boatLandingPath,
  connectionLandingPath,
  crewLandingPath,
  orgLandingPath,
} from './invite-outcome'

const PERSON = { id: true, name: true, image: true } as const

type Person = { id: string; name: string; image: string | null }

function mediaPath(token: string, slot: string) {
  return `/api/invite-media/${encodeURIComponent(token)}/${slot}`
}

function personIcon(token: string, person: Person): InviteFaceIcon {
  const external =
    person.image?.startsWith('https://') || person.image?.startsWith('http://')
      ? person.image
      : null
  return {
    name: person.name || 'Member',
    imageUrl:
      external ??
      (person.image ? mediaPath(token, `people/${person.id}`) : null),
  }
}

function emptyFace(kind: InviteFace['kind'], email: string | null): InviteFace {
  return {
    kind,
    valid: false,
    email,
    message: '',
    hero: null,
    people: [],
    boats: [],
  }
}

export type InviteArtwork = {
  face: InviteFace
  landingPath: string | null
}

async function inviteeId(email: string | null) {
  if (!email) return null
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  })
  return user?.id ?? null
}

export async function loadInviteArtwork(
  token: string,
): Promise<InviteArtwork | null> {
  const member = await prisma.memberInvite.findUnique({
    where: { token },
    select: {
      kind: true,
      status: true,
      expiresAt: true,
      inviteeEmail: true,
      orgId: true,
      boatId: true,
    },
  })
  if (member) return memberArtwork(token, member)

  const crew = await prisma.crewInvite.findUnique({
    where: { token },
    select: {
      status: true,
      expiresAt: true,
      inviteeEmail: true,
      inviterUserId: true,
      crewMemberId: true,
      inviter: { select: PERSON },
    },
  })
  if (crew) return crewArtwork(token, crew)

  const connection = await prisma.connectionInvite.findUnique({
    where: { token },
    select: {
      status: true,
      expiresAt: true,
      inviteeEmail: true,
      inviterUserId: true,
    },
  })
  if (connection) {
    const inviter = await prisma.user.findUnique({
      where: { id: connection.inviterUserId },
      select: PERSON,
    })
    if (inviter) return connectionArtwork(token, { ...connection, inviter })
  }
  return null
}

function isOpen(status: string, expiresAt: Date) {
  return status === 'PENDING' && expiresAt.getTime() > Date.now()
}

async function memberArtwork(
  token: string,
  invite: {
    kind: string
    status: string
    expiresAt: Date
    inviteeEmail: string | null
    orgId: string | null
    boatId: string | null
  },
): Promise<InviteArtwork> {
  const open = isOpen(invite.status, invite.expiresAt)
  if (invite.kind === 'BOAT' && invite.boatId) {
    const landingPath = boatLandingPath(invite.boatId)
    if (!open)
      return { face: emptyFace('boat', invite.inviteeEmail), landingPath }
    const boat = await prisma.boat.findUnique({
      where: { id: invite.boatId },
      include: {
        photos: {
          orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
        },
        user: { select: PERSON },
        members: { take: 12, include: { user: { select: PERSON } } },
      },
    })
    const people = uniquePeople([
      boat?.user,
      ...(boat?.members.map((member) => member.user) ?? []),
    ])
    return {
      landingPath,
      face: {
        kind: 'boat',
        valid: true,
        email: invite.inviteeEmail,
        message: boatInviteMessage(boat?.name ?? 'the boat'),
        hero: {
          name: boat?.name ?? 'Boat',
          imageUrl: boat?.photos[0]
            ? mediaPath(token, `boats/${invite.boatId}`)
            : null,
        },
        people: people.map((person) => personIcon(token, person)),
        boats: [],
      },
    }
  }

  const landingPath = invite.orgId ? orgLandingPath(invite.orgId) : null
  if (!open || !invite.orgId) {
    return { face: emptyFace('org', invite.inviteeEmail), landingPath }
  }
  const org = await prisma.consortium.findUnique({
    where: { id: invite.orgId },
    include: {
      photos: {
        orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
        take: 1,
      },
      boats: {
        take: 6,
        orderBy: { name: 'asc' },
        include: {
          photos: {
            orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
          },
        },
      },
      members: { take: 12, include: { user: { select: PERSON } } },
    },
  })
  return {
    landingPath,
    face: {
      kind: 'org',
      valid: true,
      email: invite.inviteeEmail,
      message: orgInviteMessage(org?.name ?? 'the organization'),
      hero: {
        name: org?.name ?? 'Organization',
        imageUrl: org?.photos[0] ? mediaPath(token, 'org') : null,
      },
      people: (org?.members ?? []).map((member) =>
        personIcon(token, member.user),
      ),
      boats: (org?.boats ?? []).map((boat) => ({
        name: boat.name,
        imageUrl: boat.photos[0] ? mediaPath(token, `boats/${boat.id}`) : null,
      })),
    },
  }
}

async function crewArtwork(
  token: string,
  invite: {
    status: string
    expiresAt: Date
    inviteeEmail: string
    inviterUserId: string
    crewMemberId: string
    inviter: Person
  },
): Promise<InviteArtwork> {
  const invitee = await inviteeId(invite.inviteeEmail)
  const landingPath = invitee
    ? await crewLandingPath(invite.inviterUserId, invitee)
    : null
  if (!isOpen(invite.status, invite.expiresAt)) {
    return { face: emptyFace('crew', invite.inviteeEmail), landingPath }
  }
  const members = await prisma.crewMember.findMany({
    where: {
      ownerUserId: invite.inviterUserId,
      NOT: { id: invite.crewMemberId },
    },
    take: 8,
    include: { linkedUser: { select: PERSON } },
  })
  return {
    landingPath,
    face: {
      kind: 'crew',
      valid: true,
      email: invite.inviteeEmail,
      message: crewInviteMessage(invite.inviter.name),
      hero: personIcon(token, invite.inviter),
      people: members.map((member) =>
        member.linkedUser
          ? personIcon(token, member.linkedUser)
          : { name: member.displayName || 'Crew', imageUrl: null },
      ),
      boats: [],
    },
  }
}

async function connectionArtwork(
  token: string,
  invite: {
    status: string
    expiresAt: Date
    inviteeEmail: string
    inviterUserId: string
    inviter: Person
  },
): Promise<InviteArtwork> {
  const invitee = await inviteeId(invite.inviteeEmail)
  const landingPath = invitee
    ? connectionLandingPath(invite.inviterUserId, invitee)
    : null
  if (!isOpen(invite.status, invite.expiresAt)) {
    return { face: emptyFace('connection', invite.inviteeEmail), landingPath }
  }
  return {
    landingPath,
    face: {
      kind: 'connection',
      valid: true,
      email: invite.inviteeEmail,
      message: connectionInviteMessage(invite.inviter.name),
      hero: personIcon(token, invite.inviter),
      people: [],
      boats: [],
    },
  }
}

function uniquePeople(people: Array<Person | null | undefined>) {
  const seen = new Set<string>()
  const result: Person[] = []
  for (const person of people) {
    if (!person || seen.has(person.id)) continue
    seen.add(person.id)
    result.push(person)
  }
  return result.slice(0, 8)
}

export async function readInviteImage(
  token: string,
  slot: string,
): Promise<
  { bytes: Uint8Array; contentType: string } | { redirect: string } | null
> {
  const artwork = await loadInviteArtwork(token)
  if (!artwork?.face.valid) return null
  const allowed = new Set<string>()
  for (const icon of [
    artwork.face.hero,
    ...artwork.face.boats,
    ...artwork.face.people,
  ]) {
    const match = icon?.imageUrl?.match(/\/invite-media\/[^/]+\/(.+)$/)
    if (match) allowed.add(decodeURIComponent(match[1]))
  }
  if (!allowed.has(slot)) return null

  if (slot.startsWith('people/')) {
    const userId = slot.slice('people/'.length)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    })
    if (
      user?.image?.startsWith('http://') ||
      user?.image?.startsWith('https://')
    ) {
      return { redirect: user.image }
    }
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']) {
      try {
        const object = await getPhotoObject(profilePhotoS3Key(userId, ext))
        if (!object.Body) continue
        return {
          bytes: await object.Body.transformToByteArray(),
          contentType: object.ContentType || 'image/jpeg',
        }
      } catch {
        // try the next extension
      }
    }
    return null
  }

  if (slot.startsWith('boats/')) {
    const boatId = slot.slice('boats/'.length)
    const photo = await prisma.boatPhoto.findFirst({
      where: { boatId },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    })
    if (!photo) return null
    const object = await getPhotoObject(photo.s3Key)
    if (!object.Body) return null
    return {
      bytes: await object.Body.transformToByteArray(),
      contentType: photo.mimeType || object.ContentType || 'image/jpeg',
    }
  }

  if (slot === 'org') {
    const member = await prisma.memberInvite.findUnique({
      where: { token },
      select: { orgId: true },
    })
    if (!member?.orgId) return null
    const photo = await prisma.consortiumPhoto.findFirst({
      where: { consortiumId: member.orgId },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    })
    if (!photo) return null
    const object = await getPhotoObject(photo.s3Key)
    if (!object.Body) return null
    return {
      bytes: await object.Body.transformToByteArray(),
      contentType: photo.mimeType || object.ContentType || 'image/jpeg',
    }
  }
  return null
}
