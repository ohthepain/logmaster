import type { Boat } from '../domain/boat'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
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
    throw new Error(text || `Request failed (${response.status})`)
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

export async function createBoat(name: string): Promise<Boat> {
  const data = await api<{ boat: Boat }>('/api/boats', {
    method: 'POST',
    body: JSON.stringify({ name }),
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
