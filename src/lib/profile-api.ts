export type ProfileUser = {
  id: string
  name: string
  email: string
  image: string | null
  tutorialCompleted: boolean
}

const PROFILE_IMAGE_PATH = '/api/profile/photo'

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

export function isCustomProfilePhoto(image: string | null | undefined): boolean {
  return image === PROFILE_IMAGE_PATH
}

export function profilePhotoUrl(
  image: string | null | undefined,
  cacheBust?: number,
): string | null {
  if (!image) return null
  if (isCustomProfilePhoto(image)) {
    return cacheBust ? `${PROFILE_IMAGE_PATH}?v=${cacheBust}` : PROFILE_IMAGE_PATH
  }
  return image
}

export async function fetchProfile(): Promise<ProfileUser> {
  const data = await api<{ user: ProfileUser }>('/api/profile')
  return data.user
}

export async function updateProfileName(name: string): Promise<ProfileUser> {
  const data = await api<{ user: ProfileUser }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
  return data.user
}

export async function uploadProfilePhoto(file: File): Promise<ProfileUser> {
  const form = new FormData()
  form.append('file', file)
  const data = await api<{ user: ProfileUser }>('/api/profile/photo', {
    method: 'POST',
    body: form,
  })
  return data.user
}

export async function deleteProfilePhoto(): Promise<ProfileUser> {
  const data = await api<{ user: ProfileUser }>('/api/profile/photo', {
    method: 'DELETE',
  })
  return data.user
}

export async function completeTutorial(): Promise<ProfileUser> {
  const data = await api<{ user: ProfileUser }>('/api/profile/tutorial/complete', {
    method: 'POST',
  })
  return data.user
}

export async function resetTutorial(): Promise<ProfileUser> {
  const data = await api<{ user: ProfileUser }>('/api/profile/tutorial/reset', {
    method: 'POST',
  })
  return data.user
}
