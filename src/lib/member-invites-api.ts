import type {
  MemberInvite,
  MemberInvitePreview,
} from '../domain/member-invite'
import { apiUrl } from './app-origin'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
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

export async function fetchMemberInvitePreview(
  token: string,
): Promise<MemberInvitePreview> {
  const data = await api<{ preview: MemberInvitePreview }>(
    `/api/member-invites/preview/${encodeURIComponent(token)}`,
  )
  return data.preview
}

export async function acceptMemberInvite(token: string): Promise<{
  ok: true
  kind: MemberInvite['kind']
  orgId: string | null
  boatId: string | null
  targetName: string
}> {
  return api('/api/member-invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function acceptPendingMemberInvites(): Promise<{
  accepted: Array<{
    kind: string
    orgId: string | null
    boatId: string | null
  }>
}> {
  return api('/api/member-invites/accept-pending', { method: 'POST' })
}
