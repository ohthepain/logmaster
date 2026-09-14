import type { BoatShareSummary } from '../domain/boat-shares'
import { apiJson } from './api-client'

export type BoatSharesPayload = {
  shareCount: number
  shares: BoatShareSummary[]
  canManageShares?: boolean
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiJson<T>(path, init)
}

export async function fetchBoatShares(
  boatId: string,
): Promise<BoatSharesPayload> {
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
