import type {
  BoatDocument,
  BoatDocumentCategory,
  BoatDocumentVersion,
  BoatDocumentsPayload,
} from '../domain/boat'
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

export async function fetchBoatDocuments(
  boatId: string,
): Promise<BoatDocumentsPayload> {
  return api<BoatDocumentsPayload>(`/api/boats/${boatId}/documents`)
}

export async function createBoatDocumentCategory(
  boatId: string,
  name: string,
): Promise<BoatDocumentCategory> {
  const data = await api<{ category: BoatDocumentCategory }>(
    `/api/boats/${boatId}/document-categories`,
    { method: 'POST', body: JSON.stringify({ name }) },
  )
  return data.category
}

export async function createBoatDocumentUpload(
  boatId: string,
  input: {
    title: string
    categoryId: string
    file: File
    purpose?: DocumentPurpose | null
  },
): Promise<BoatDocument> {
  const form = new FormData()
  form.append('title', input.title)
  form.append('categoryId', input.categoryId)
  form.append('file', input.file)
  if (input.purpose) form.append('purpose', input.purpose)
  const data = await api<{ document: BoatDocument }>(
    `/api/boats/${boatId}/documents`,
    { method: 'POST', body: form },
  )
  return data.document
}

export async function createBoatDocumentLink(
  boatId: string,
  input: {
    title: string
    categoryId: string
    url: string
    purpose?: DocumentPurpose | null
  },
): Promise<BoatDocument> {
  const data = await api<{ document: BoatDocument }>(
    `/api/boats/${boatId}/documents`,
    { method: 'POST', body: JSON.stringify({ ...input, kind: 'link' }) },
  )
  return data.document
}

export async function updateBoatDocumentUpload(
  documentId: string,
  file: File,
): Promise<BoatDocument> {
  const form = new FormData()
  form.append('file', file)
  const data = await api<{ document: BoatDocument }>(
    `/api/boats/documents/${documentId}`,
    { method: 'PATCH', body: form },
  )
  return data.document
}

export async function updateBoatDocumentLink(
  documentId: string,
  url: string,
): Promise<BoatDocument> {
  const data = await api<{ document: BoatDocument }>(
    `/api/boats/documents/${documentId}`,
    { method: 'PATCH', body: JSON.stringify({ url }) },
  )
  return data.document
}

export async function updateBoatDocumentMetadata(
  documentId: string,
  patch: {
    title?: string
    categoryId?: string
    purpose?: DocumentPurpose | null
  },
): Promise<BoatDocument> {
  const data = await api<{ document: BoatDocument }>(
    `/api/boats/documents/${documentId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
  return data.document
}

export async function deleteBoatDocument(documentId: string): Promise<void> {
  await api(`/api/boats/documents/${documentId}`, { method: 'DELETE' })
}

export async function fetchBoatDocumentVersions(
  documentId: string,
): Promise<BoatDocumentVersion[]> {
  const data = await api<{ versions: BoatDocumentVersion[] }>(
    `/api/boats/documents/${documentId}/versions`,
  )
  return data.versions
}

export async function fetchLinkDocumentTitle(
  url: string,
): Promise<string | null> {
  const params = new URLSearchParams({ url })
  const data = await api<{ title: string | null }>(
    `/api/boats/link-metadata?${params.toString()}`,
  )
  return data.title
}
