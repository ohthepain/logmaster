import type { Trip } from '../domain/logbook'
import type {
  CatalogCrawlRepeatMode,
  CatalogCrawlRunDetail,
  CatalogCrawlRunSummary,
} from './admin-jobs'
import { apiJson } from './api-client'

export type AdminUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  createdAt: string
  platformAdminAt: string | null
  envAdminAllowlist: boolean
  isPlatformAdmin: boolean
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiJson<T>(path, init)
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

export async function setAdminUserPlatformAdmin(
  userId: string,
  admin: boolean,
): Promise<AdminUser> {
  const data = await api<{ user: AdminUser }>(
    `/api/admin/users/${userId}/platform-admin`,
    { method: 'PATCH', body: JSON.stringify({ admin }) },
  )
  return data.user
}

export async function fetchAdminTrips(): Promise<Trip[]> {
  const data = await api<{ trips: Trip[] }>('/api/admin/trips')
  return data.trips
}

export async function deleteAdminTrip(tripId: string): Promise<void> {
  await api(`/api/admin/trips/${tripId}`, { method: 'DELETE' })
}

export type AdminTranslationOverride = {
  language: string
  key: string
  value: string
  updatedAt: string
}

export async function fetchAdminTranslationOverrides(): Promise<
  AdminTranslationOverride[]
> {
  const data = await api<{ overrides: AdminTranslationOverride[] }>(
    '/api/admin/translations',
  )
  return data.overrides
}

export async function saveAdminTranslation(
  language: string,
  key: string,
  value: string,
): Promise<AdminTranslationOverride> {
  const data = await api<{ override: AdminTranslationOverride }>(
    `/api/admin/translations/${encodeURIComponent(language)}/${encodeURIComponent(key)}`,
    { method: 'PUT', body: JSON.stringify({ value }) },
  )
  return data.override
}

export async function resetAdminTranslation(
  language: string,
  key: string,
): Promise<void> {
  await api(
    `/api/admin/translations/${encodeURIComponent(language)}/${encodeURIComponent(key)}`,
    { method: 'DELETE' },
  )
}

export type AdminOrg = {
  id: string
  name: string
  ownerUserId: string
  owner: { id: string; name: string; email: string }
  visibility: string
  memberCount: number
  boatCount: number
  createdAt: string
  updatedAt: string
}

export async function fetchAdminOrgs(): Promise<AdminOrg[]> {
  const data = await api<{ orgs: AdminOrg[] }>('/api/admin/orgs')
  return data.orgs
}

export async function updateAdminOrgOwner(
  orgId: string,
  ownerUserId: string,
): Promise<AdminOrg> {
  const data = await api<{ org: AdminOrg }>(`/api/admin/orgs/${orgId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ownerUserId }),
  })
  return data.org
}

export async function deleteAdminOrg(orgId: string): Promise<void> {
  await api(`/api/admin/orgs/${orgId}`, { method: 'DELETE' })
}

export async function cancelAdminJob(
  jobId: string,
): Promise<{ jobId: string }> {
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

export type {
  CatalogCrawlRepeatMode,
  CatalogCrawlRunDetail,
  CatalogCrawlRunSummary,
} from './admin-jobs'

export async function fetchCatalogCrawlRuns(
  limit = 25,
): Promise<CatalogCrawlRunSummary[]> {
  const data = await api<{ crawls: CatalogCrawlRunSummary[] }>(
    `/api/admin/catalog-crawls?limit=${encodeURIComponent(String(limit))}`,
  )
  return data.crawls
}

export async function fetchCatalogCrawlRun(
  runId: string,
  signal?: AbortSignal,
): Promise<CatalogCrawlRunDetail> {
  const data = await api<{ crawl: CatalogCrawlRunDetail }>(
    `/api/admin/catalog-crawls/${encodeURIComponent(runId)}`,
    { signal },
  )
  return data.crawl
}

export async function repeatCatalogCrawl(
  runId: string,
  mode: CatalogCrawlRepeatMode,
): Promise<{ jobId: string }> {
  const data = await api<{ jobId: string }>(
    `/api/admin/catalog-crawls/${encodeURIComponent(runId)}/repeat`,
    { method: 'POST', body: JSON.stringify({ mode }) },
  )
  return { jobId: data.jobId }
}

export async function deleteCatalogCrawl(runId: string): Promise<void> {
  await api(`/api/admin/catalog-crawls/${encodeURIComponent(runId)}`, {
    method: 'DELETE',
  })
}
