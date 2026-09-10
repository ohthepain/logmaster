import type {
  BoatContact,
  BoatContactDetail,
  ContactResourceArea,
} from '../domain/contact'
import { apiUrl } from './app-origin'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function fetchBoatContacts(boatId: string): Promise<BoatContact[]> {
  const data = await api<{ contacts: BoatContact[] }>(
    `/api/boats/${boatId}/contacts`,
  )
  return data.contacts
}

export async function createBoatContact(
  boatId: string,
  input: {
    displayName: string
    email?: string
    phone?: string
    whatsapp?: string
    notes?: string
    grants?: ContactResourceArea[]
  },
): Promise<BoatContact> {
  const data = await api<{ contact: BoatContact }>(`/api/boats/${boatId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.contact
}

export async function fetchBoatContactDetail(
  boatId: string,
  contactId: string,
): Promise<BoatContactDetail> {
  return api<BoatContactDetail>(`/api/boats/${boatId}/contacts/${contactId}`)
}

export async function updateBoatContact(
  boatId: string,
  contactId: string,
  input: Partial<{
    displayName: string
    email: string | null
    phone: string | null
    whatsapp: string | null
    notes: string | null
    grants: ContactResourceArea[]
  }>,
): Promise<BoatContact> {
  const data = await api<{ contact: BoatContact }>(
    `/api/boats/${boatId}/contacts/${contactId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
  return data.contact
}

export async function deleteBoatContact(
  boatId: string,
  contactId: string,
): Promise<void> {
  await api(`/api/boats/${boatId}/contacts/${contactId}`, { method: 'DELETE' })
}
