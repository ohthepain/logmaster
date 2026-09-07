import type {
  OrgDocument,
  OrgDocumentCategory,
  OrgDocumentVersion,
  OrgDocumentsPayload,
} from '../domain/org'
import type { DocumentPurpose } from '../domain/boat-assets'
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

export async function fetchOrgDocuments(
  orgId: string,
): Promise<OrgDocumentsPayload> {
  return api<OrgDocumentsPayload>(
    `/api/orgs/${orgId}/documents`,
  )
}

export async function createOrgDocumentCategory(
  orgId: string,
  name: string,
): Promise<OrgDocumentCategory> {
  const data = await api<{ category: OrgDocumentCategory }>(
    `/api/orgs/${orgId}/document-categories`,
    { method: 'POST', body: JSON.stringify({ name }) },
  )
  return data.category
}

export async function createOrgDocumentUpload(
  orgId: string,
  input: {
    title: string
    categoryId: string
    file: File
    purpose?: DocumentPurpose | null
  },
): Promise<OrgDocument> {
  const form = new FormData()
  form.append('title', input.title)
  form.append('categoryId', input.categoryId)
  form.append('file', input.file)
  if (input.purpose) form.append('purpose', input.purpose)
  const data = await api<{ document: OrgDocument }>(
    `/api/orgs/${orgId}/documents`,
    { method: 'POST', body: form },
  )
  return data.document
}

export async function createOrgDocumentLink(
  orgId: string,
  input: {
    title: string
    categoryId: string
    url: string
    purpose?: DocumentPurpose | null
  },
): Promise<OrgDocument> {
  const data = await api<{ document: OrgDocument }>(
    `/api/orgs/${orgId}/documents`,
    { method: 'POST', body: JSON.stringify({ ...input, kind: 'link' }) },
  )
  return data.document
}

export async function updateOrgDocumentUpload(
  documentId: string,
  file: File,
): Promise<OrgDocument> {
  const form = new FormData()
  form.append('file', file)
  const data = await api<{ document: OrgDocument }>(
    `/api/orgs/documents/${documentId}`,
    { method: 'PATCH', body: form },
  )
  return data.document
}

export async function updateOrgDocumentLink(
  documentId: string,
  url: string,
): Promise<OrgDocument> {
  const data = await api<{ document: OrgDocument }>(
    `/api/orgs/documents/${documentId}`,
    { method: 'PATCH', body: JSON.stringify({ url }) },
  )
  return data.document
}

export async function updateOrgDocumentMetadata(
  documentId: string,
  patch: {
    title?: string
    categoryId?: string
    purpose?: DocumentPurpose | null
  },
): Promise<OrgDocument> {
  const data = await api<{ document: OrgDocument }>(
    `/api/orgs/documents/${documentId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
  return data.document
}

export async function deleteOrgDocument(documentId: string): Promise<void> {
  await api(`/api/orgs/documents/${documentId}`, { method: 'DELETE' })
}

export async function fetchOrgDocumentVersions(
  documentId: string,
): Promise<OrgDocumentVersion[]> {
  const data = await api<{ versions: OrgDocumentVersion[] }>(
    `/api/orgs/documents/${documentId}/versions`,
  )
  return data.versions
}

export async function fetchOrgLinkDocumentTitle(
  url: string,
): Promise<string | null> {
  const params = new URLSearchParams({ url })
  const data = await api<{ title: string | null }>(
    `/api/boats/link-metadata?${params.toString()}`,
  )
  return data.title
}

export async function fetchOrgDocumentBytes(
  versionId: string,
): Promise<ArrayBuffer> {
  const response = await fetch(
    apiUrl(`/api/orgs/documents/versions/${versionId}/content`),
    { credentials: 'include' },
  )
  if (!response.ok) {
    throw new Error(`Failed to load document (${response.status})`)
  }
  return response.arrayBuffer()
}
