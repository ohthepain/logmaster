import type {
  CrewInvitePreview,
  CrewMember,
  CrewPayload,
} from '../domain/crew'
import { apiUrl } from './app-origin'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(`/api/crew${path}`), {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function fetchCrew(): Promise<CrewPayload> {
  return api<CrewPayload>('/')
}

export async function createCrewMember(args: {
  name: string
  email?: string
  photo?: File
}): Promise<{ member: CrewMember }> {
  const form = new FormData()
  form.set('name', args.name.trim())
  if (args.email?.trim()) form.set('email', args.email.trim())
  if (args.photo) form.set('photo', args.photo)
  return api<{ member: CrewMember }>('/members', { method: 'POST', body: form })
}

export async function deleteCrewMember(memberId: string): Promise<void> {
  await api<{ ok: true }>(`/members/${memberId}`, { method: 'DELETE' })
}

export async function updateCrewMember(
  memberId: string,
  args: { name?: string; email?: string | null },
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

export async function acceptCrewInvite(token: string): Promise<void> {
  await api<{ ok: true }>('/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function fetchCrewInvitePreview(
  token: string,
): Promise<CrewInvitePreview> {
  return api<CrewInvitePreview>(
    `/invites/preview/${encodeURIComponent(token)}`,
  )
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

export function crewMemberPhotoUrl(memberId: string, cacheBust?: number): string {
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
    image === '/api/profile/photo'
      ? `/api/crew/users/${userId}/photo`
      : image
  return cacheBust ? `${url}?v=${cacheBust}` : url
}
