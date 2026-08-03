import type { Trip } from '../domain/logbook'
import { apiUrl } from './app-origin'

export type AdminUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  createdAt: string
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
    throw new Error(text || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function fetchAdminStatus(): Promise<{ admin: boolean }> {
  return api('/api/admin/status')
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const data = await api<{ users: AdminUser[] }>('/api/admin/users')
  return data.users
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await api(`/api/admin/users/${userId}`, { method: 'DELETE' })
}

export async function fetchAdminTrips(): Promise<Trip[]> {
  const data = await api<{ trips: Trip[] }>('/api/admin/trips')
  return data.trips
}

export async function deleteAdminTrip(tripId: string): Promise<void> {
  await api(`/api/admin/trips/${tripId}`, { method: 'DELETE' })
}

export async function cancelAdminJob(jobId: string): Promise<{ jobId: string }> {
  const data = await api<{ jobId: string }>(
    `/api/admin/jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: 'POST' },
  )
  return { jobId: data.jobId }
}

export async function rerunAdminJob(jobId: string): Promise<{ jobId: string }> {
  const data = await api<{ jobId: string }>(
    `/api/admin/jobs/${encodeURIComponent(jobId)}/rerun`,
    { method: 'POST' },
  )
  return { jobId: data.jobId }
}
