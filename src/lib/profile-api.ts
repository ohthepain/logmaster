import { apiJson } from './api-client'
import { apiUrl } from './app-origin'
import type { InviteLocale } from './invite-locale'
import type { ProfilePhotoCrop } from './profile-photo-crop'

export type ProfileUser = {
  id: string
  name: string
  email: string
  image: string | null
  tutorialCompleted: boolean
  preferredLanguage: string | null
}

const PROFILE_IMAGE_PATH = '/api/profile/photo'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiJson<T>(path, init)
}

export function isCustomProfilePhoto(
  image: string | null | undefined,
): boolean {
  return image === PROFILE_IMAGE_PATH
}

export function profilePhotoUrl(
  image: string | null | undefined,
  cacheBust?: number,
): string | null {
  if (!image) return null
  if (isCustomProfilePhoto(image)) {
    const path = cacheBust
      ? `${PROFILE_IMAGE_PATH}?v=${cacheBust}`
      : PROFILE_IMAGE_PATH
    return apiUrl(path)
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

export async function updateProfilePreferredLanguage(
  language: InviteLocale,
): Promise<ProfileUser> {
  const data = await api<{ user: ProfileUser }>('/api/profile/language', {
    method: 'PATCH',
    body: JSON.stringify({ language }),
  })
  return data.user
}

export async function uploadProfilePhoto(
  file: File,
  crop: ProfilePhotoCrop,
): Promise<ProfileUser> {
  const form = new FormData()
  form.append('file', file)
  form.append('crop', JSON.stringify(crop))
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
  const data = await api<{ user: ProfileUser }>(
    '/api/profile/tutorial/complete',
    {
      method: 'POST',
    },
  )
  return data.user
}

export async function resetTutorial(): Promise<ProfileUser> {
  const data = await api<{ user: ProfileUser }>('/api/profile/tutorial/reset', {
    method: 'POST',
  })
  return data.user
}
