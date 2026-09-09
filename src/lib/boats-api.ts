import type { Boat } from '../domain/boat'
import type {
  InviteMemberResult,
  MemberInvite,
  ResourceMember,
} from '../domain/member-invite'
import type { OrgMemberRole } from '../domain/org'
import type { BoatIconId } from './boat-icons'
import { apiUrl } from './app-origin'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string }
      message = parsed.error ?? text
    } catch {
      // keep raw text
    }
    throw new Error(message || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function fetchBoats(): Promise<Boat[]> {
  const data = await api<{ boats: Boat[] }>('/api/boats')
  return data.boats
}

export async function fetchBoat(boatId: string): Promise<Boat> {
  const data = await api<{ boat: Boat }>(`/api/boats/${boatId}`)
  return data.boat
}

export async function createBoat(
  name: string,
  iconId?: BoatIconId,
): Promise<Boat> {
  const data = await api<{ boat: Boat }>('/api/boats', {
    method: 'POST',
    body: JSON.stringify({ name, iconId }),
  })
  return data.boat
}

export async function updateBoat(
  boatId: string,
  patch: { name?: string; iconId?: BoatIconId },
): Promise<Boat> {
  const data = await api<{ boat: Boat }>(`/api/boats/${boatId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.boat
}

export async function deleteBoat(boatId: string): Promise<void> {
  await api(`/api/boats/${boatId}`, { method: 'DELETE' })
}

export async function uploadBoatPhoto(boatId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  const data = await api<{ photo: Boat['photos'][number] }>(
    `/api/boats/${boatId}/photos`,
    { method: 'POST', body: form },
  )
  return data.photo
}

export async function updateBoatPhoto(
  photoId: string,
  patch: { caption?: string | null; isDefault?: boolean },
) {
  const data = await api<{ photo: Boat['photos'][number] }>(
    `/api/boats/photos/${photoId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
  return data.photo
}

export async function deleteBoatPhoto(photoId: string): Promise<void> {
  await api(`/api/boats/photos/${photoId}`, { method: 'DELETE' })
}

export async function fetchBoatMembers(boatId: string): Promise<{
  members: ResourceMember[]
  pendingInvites: MemberInvite[]
  canManageMembers: boolean
}> {
  const data = await api<{
    members: ResourceMember[]
    pendingInvites: MemberInvite[]
    canManageMembers: boolean
  }>(`/api/boats/${boatId}/members`)
  return data
}

export async function inviteBoatMember(
  boatId: string,
  input: { email: string; role?: OrgMemberRole; sendEmail?: boolean },
): Promise<InviteMemberResult> {
  return api<InviteMemberResult>(`/api/boats/${boatId}/members`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function createBoatInviteLink(
  boatId: string,
  role: OrgMemberRole = 'MEMBER',
): Promise<MemberInvite> {
  const data = await api<{ invite: MemberInvite }>(
    `/api/boats/${boatId}/invite-link`,
    { method: 'POST', body: JSON.stringify({ role }) },
  )
  return data.invite
}

export async function updateBoatMemberRole(
  boatId: string,
  memberUserId: string,
  role: OrgMemberRole,
): Promise<ResourceMember> {
  const data = await api<{ member: ResourceMember }>(
    `/api/boats/${boatId}/members/${memberUserId}`,
    { method: 'PATCH', body: JSON.stringify({ role }) },
  )
  return data.member
}

export async function removeBoatMember(
  boatId: string,
  memberUserId: string,
): Promise<void> {
  await api(`/api/boats/${boatId}/members/${memberUserId}`, {
    method: 'DELETE',
  })
}

export async function cancelBoatInvite(
  boatId: string,
  inviteId: string,
): Promise<void> {
  await api(`/api/boats/${boatId}/invites/${inviteId}`, { method: 'DELETE' })
}

export async function resendBoatInvite(
  boatId: string,
  inviteId: string,
): Promise<void> {
  await api(`/api/boats/${boatId}/invites/${inviteId}/resend`, { method: 'POST' })
}
