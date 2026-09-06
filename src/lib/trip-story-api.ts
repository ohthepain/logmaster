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
    throw new Error(text || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function uploadTripStoryMedia(
  tripId: string,
  file: Blob,
  fileName?: string,
): Promise<{ id: string; url: string }> {
  const form = new FormData()
  form.append(
    'file',
    file,
    fileName ?? (file instanceof File ? file.name : 'upload'),
  )
  return api<{ id: string; url: string }>(
    `/api/logbook/trips/${tripId}/story/media`,
    { method: 'POST', body: form },
  )
}

export function absoluteStoryMediaUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl
  }
  return apiUrl(relativeUrl)
}
