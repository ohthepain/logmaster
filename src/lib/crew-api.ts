import type { CrewInvitePreview, CrewMember, CrewPayload } from '../domain/crew'
import { apiJson } from './api-client'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiJson<T>(`/api/crew${path}`, init)
}

export type TripCrewInviteSummary = {
  id: string
  email: string
  expiresAt: string
}

export type TripCrewInviteResult = {
  user?: { id: string; name: string; imageUrl: string | null }
  invite?: TripCrewInviteSummary
}

export async function fetchTripCrewInvites(
  tripId: string,
): Promise<TripCrewInviteSummary[]> {
  const data = await api<{ invites: TripCrewInviteSummary[] }>(
    `/trip-invites?tripId=${encodeURIComponent(tripId)}`,
  )
  return data.invites
}

export async function sendTripCrewInvite(args: {
  tripId: string
  email: string
  inviteLocale?: string
}): Promise<TripCrewInviteResult> {
  return api<TripCrewInviteResult>('/trip-invites', {
    method: 'POST',
    body: JSON.stringify(args),
  })
}

export async function cancelTripCrewInvite(inviteId: string): Promise<void> {
  await api<{ ok: true }>(`/trip-invites/${encodeURIComponent(inviteId)}`, {
    method: 'DELETE',
  })
}

export async function fetchCrew(): Promise<CrewPayload> {
  return api<CrewPayload>('/')
}

export async function createCrewMember(args: {
  name: string
  email?: string
  inviteLocale?: string
  photo?: File
}): Promise<{ member: CrewMember }> {
  const form = new FormData()
  form.set('name', args.name.trim())
  if (args.email?.trim()) form.set('email', args.email.trim())
  if (args.inviteLocale?.trim())
    form.set('inviteLocale', args.inviteLocale.trim())
  if (args.photo) form.set('photo', args.photo)
  return api<{ member: CrewMember }>('/members', { method: 'POST', body: form })
}

export async function deleteCrewMember(memberId: string): Promise<void> {
  await api<{ ok: true }>(`/members/${memberId}`, { method: 'DELETE' })
}

export async function updateCrewMember(
  memberId: string,
  args: { name?: string; email?: string | null; inviteLocale?: string },
): Promise<{ member: CrewMember }> {
  return api<{ member: CrewMember }>(`/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(args),
  })
}

export async function uploadCrewMemberPhoto(
  memberId: string,
  photo: File,
): Promise<{ member: CrewMember }> {
  const form = new FormData()
  form.set('photo', photo)
  return api<{ member: CrewMember }>(`/members/${memberId}/photo`, {
    method: 'POST',
    body: form,
  })
}

export async function deleteCrewMemberPhoto(
  memberId: string,
): Promise<{ member: CrewMember }> {
  return api<{ member: CrewMember }>(`/members/${memberId}/photo`, {
    method: 'DELETE',
  })
}

export async function resendCrewInvite(inviteId: string): Promise<void> {
  await api<{ ok: true }>(`/invites/${inviteId}/resend`, { method: 'POST' })
}

export async function acceptCrewInvite(token: string): Promise<{
  ok: true
  landingPath: string
}> {
  return api<{ ok: true; landingPath: string }>('/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function fetchCrewInvitePreview(
  token: string,
): Promise<CrewInvitePreview> {
  return api<CrewInvitePreview>(`/invites/preview/${encodeURIComponent(token)}`)
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  await api<{ ok: true }>(`/friend-requests/${requestId}/accept`, {
    method: 'POST',
  })
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  await api<{ ok: true }>(`/friend-requests/${requestId}/decline`, {
    method: 'POST',
  })
}

export function crewMemberPhotoUrl(
  memberId: string,
  cacheBust?: number,
): string {
  const url = `/api/crew/members/${memberId}/photo`
  return cacheBust ? `${url}?v=${cacheBust}` : url
}

export function crewUserPhotoUrl(
  userId: string,
  image: string | null | undefined,
  cacheBust?: number,
): string | null {
  if (!image) return null
  if (image.startsWith('http://') || image.startsWith('https://')) return image
  const url =
    image === '/api/profile/photo' ? `/api/crew/users/${userId}/photo` : image
  return cacheBust ? `${url}?v=${cacheBust}` : url
}
