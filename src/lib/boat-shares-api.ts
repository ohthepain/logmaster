import type { BoatShareSummary } from '../domain/boat-shares'
import { apiUrl } from './app-origin'

export type BoatSharesPayload = {
  shareCount: number
  shares: BoatShareSummary[]
  canManageShares?: boolean
}

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

export async function fetchBoatShares(boatId: string): Promise<BoatSharesPayload> {
  return api<BoatSharesPayload>(`/api/boats/${boatId}/shares`)
}

export async function updateBoatShares(
  boatId: string,
  patch: { shareCount?: number; order?: string[] },
): Promise<BoatSharesPayload> {
  return api<BoatSharesPayload>(`/api/boats/${boatId}/shares`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function updateBoatShareLabel(
  boatId: string,
  shareId: string,
  label: string | null,
): Promise<BoatSharesPayload> {
  return api<BoatSharesPayload>(`/api/boats/${boatId}/shares/${shareId}`, {
    method: 'PATCH',
    body: JSON.stringify({ label }),
  })
}

export async function addBoatShareOwner(
  boatId: string,
  shareId: string,
  email: string,
): Promise<BoatSharesPayload> {
  return api<BoatSharesPayload>(
    `/api/boats/${boatId}/shares/${shareId}/owners`,
    { method: 'POST', body: JSON.stringify({ email }) },
  )
}

export async function removeBoatShareOwner(
  boatId: string,
  shareId: string,
  ownerUserId: string,
): Promise<BoatSharesPayload> {
  return api<BoatSharesPayload>(
    `/api/boats/${boatId}/shares/${shareId}/owners/${ownerUserId}`,
    { method: 'DELETE' },
  )
}
