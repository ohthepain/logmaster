import type {
  AssetWork,
  AssetWorkType,
  AssetOwnership,
  BoatAccountingSummary,
  BoatAsset,
  BoatAssetDetail,
  BoatPurchase,
  DocumentPurpose,
} from '../domain/boat-assets'
import { apiUrl } from './app-origin'
import type {
  AssetCategory,
  AssetConnectionSuggestion,
  AssetIdentification,
  AssetResearch,
} from '../domain/asset-intelligence'
import {
  createBoatDocumentUpload,
  createBoatDocumentLink,
  fetchBoatDocuments,
} from './boat-documents-api'
import {
  documentTitleFromFileName,
  resolveDocumentLinkTitle,
} from './document-title'

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
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string }
      message = parsed.error ?? text
    } catch {
      // keep raw text
    }
    throw new Error(message || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function fetchBoatAssets(boatId: string): Promise<BoatAsset[]> {
  const data = await api<{ assets: BoatAsset[] }>(`/api/boats/${boatId}/assets`)
  return data.assets
}

export async function fetchBoatAsset(
  boatId: string,
  assetId: string,
): Promise<{ asset: BoatAssetDetail; boat: { id: string; name: string } }> {
  return api<{ asset: BoatAssetDetail; boat: { id: string; name: string } }>(
    `/api/boats/${boatId}/assets/${assetId}`,
  )
}

export async function createBoatAsset(
  boatId: string,
  input: {
    name: string
    description?: string | null
    modelNumber?: string | null
    category?: AssetCategory | null
    suggestedDownloads?: AssetResearch['downloads']
    confirmedConnections?: AssetConnectionSuggestion[]
    ownership: AssetOwnership
    ownedByUserId?: string | null
    onLoanFromUserId?: string | null
    installedAt?: string | null
  },
  photo?: File,
): Promise<BoatAsset> {
  const form = new FormData()
  form.append('data', JSON.stringify(input))
  if (photo) {
    form.append('photo', photo, photo.name || 'asset-photo.jpg')
  }
  const data = await api<{ asset: BoatAsset }>(`/api/boats/${boatId}/assets`, {
    method: 'POST',
    body: form,
  })
  const asset = data.asset
  if (
    photo &&
    !(asset.documents ?? []).some((document) => document.purpose === 'photo')
  ) {
    await uploadAndLinkAssetDocument(boatId, asset.id, photo, 'photo')
  }
  return asset
}

export async function updateBoatAsset(
  boatId: string,
  assetId: string,
  input: Partial<{
    name: string
    description: string | null
    modelNumber: string | null
    category: AssetCategory | null
    ownership: AssetOwnership
    ownedByUserId: string | null
    onLoanFromUserId: string | null
    installedAt: string | null
  }>,
): Promise<BoatAsset> {
  const data = await api<{ asset: BoatAsset }>(
    `/api/boats/${boatId}/assets/${assetId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return data.asset
}

export async function identifyAssetPhoto(
  boatId: string,
  photo: File,
  signal?: AbortSignal,
): Promise<AssetIdentification> {
  const form = new FormData()
  form.append('photo', photo)
  const data = await api<{ identification: AssetIdentification }>(
    `/api/boats/${boatId}/assets/identify`,
    { method: 'POST', body: form, signal },
  )
  return data.identification
}

export async function researchNewAsset(
  boatId: string,
  input: { name: string; description: string; modelNumber: string | null },
  signal?: AbortSignal,
): Promise<AssetResearch> {
  const data = await api<{ research: AssetResearch }>(
    `/api/boats/${boatId}/assets/research`,
    { method: 'POST', body: JSON.stringify(input), signal },
  )
  return data.research
}

export async function downloadAssetSuggestion(
  boatId: string,
  assetId: string,
  suggestionId: string,
) {
  return api<{ documentId: string }>(
    `/api/boats/${boatId}/assets/${assetId}/suggestions/${suggestionId}/download`,
    { method: 'POST' },
  )
}

export async function dismissAssetSuggestion(
  boatId: string,
  assetId: string,
  suggestionId: string,
) {
  return api(
    `/api/boats/${boatId}/assets/${assetId}/suggestions/${suggestionId}`,
    { method: 'DELETE' },
  )
}

export async function removeAssetConnection(
  boatId: string,
  assetId: string,
  connectionId: string,
) {
  return api(
    `/api/boats/${boatId}/assets/${assetId}/connections/${connectionId}`,
    { method: 'DELETE' },
  )
}

export async function deleteBoatAsset(
  boatId: string,
  assetId: string,
): Promise<void> {
  await api<{ ok: boolean }>(`/api/boats/${boatId}/assets/${assetId}`, {
    method: 'DELETE',
  })
}

export async function fetchBoatPurchases(
  boatId: string,
): Promise<BoatPurchase[]> {
  const data = await api<{ purchases: BoatPurchase[] }>(
    `/api/boats/${boatId}/purchases`,
  )
  return data.purchases
}

export async function createBoatPurchase(
  boatId: string,
  input: {
    supplierName?: string | null
    purchasedAt?: string | null
    notes?: string | null
    currency?: string
    lines: Array<{
      description: string
      quantity?: number | null
      unitPrice?: number | null
      amount?: number
      assetId?: string | null
    }>
  },
): Promise<BoatPurchase> {
  const data = await api<{ purchase: BoatPurchase }>(
    `/api/boats/${boatId}/purchases`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return data.purchase
}

export async function updateBoatPurchase(
  boatId: string,
  purchaseId: string,
  input: Partial<{
    supplierName: string | null
    purchasedAt: string | null
    notes: string | null
    currency: string
    lines: Array<{
      description: string
      quantity?: number | null
      unitPrice?: number | null
      amount?: number
      assetId?: string | null
    }>
  }>,
): Promise<BoatPurchase> {
  const data = await api<{ purchase: BoatPurchase }>(
    `/api/boats/${boatId}/purchases/${purchaseId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return data.purchase
}

export async function deleteBoatPurchase(
  boatId: string,
  purchaseId: string,
): Promise<void> {
  await api<{ ok: boolean }>(`/api/boats/${boatId}/purchases/${purchaseId}`, {
    method: 'DELETE',
  })
}

export async function fetchAssetWork(
  boatId: string,
  assetId: string,
): Promise<AssetWork[]> {
  const data = await api<{ workRecords: AssetWork[] }>(
    `/api/boats/${boatId}/assets/${assetId}/work`,
  )
  return data.workRecords
}

export async function createAssetWork(
  boatId: string,
  assetId: string,
  input: {
    type: AssetWorkType
    performedAt?: string | null
    description?: string | null
    costAmount?: number | null
    costCurrency?: string | null
  },
): Promise<AssetWork> {
  const data = await api<{ work: AssetWork }>(
    `/api/boats/${boatId}/assets/${assetId}/work`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return data.work
}

export async function linkBoatDocument(
  boatId: string,
  documentId: string,
  target: { assetId?: string; purchaseId?: string; workId?: string },
): Promise<void> {
  await api<{ ok: boolean }>(
    `/api/boats/${boatId}/documents/${documentId}/links`,
    { method: 'POST', body: JSON.stringify(target) },
  )
}

export async function uploadAndLinkAssetDocument(
  boatId: string,
  assetId: string,
  file: File,
  purpose: DocumentPurpose,
): Promise<void> {
  const category = await defaultDocumentCategory(boatId)

  const document = await createBoatDocumentUpload(boatId, {
    title: documentTitleFromFileName(file.name),
    categoryId: category.id,
    file,
    purpose,
  })

  await linkBoatDocument(boatId, document.id, { assetId })
}

async function defaultDocumentCategory(boatId: string) {
  const { categories } = await fetchBoatDocuments(boatId)
  const category =
    categories.find((item) => item.name === 'Miscellaneous') ?? categories[0]
  if (!category) {
    throw new Error('No document category available')
  }
  return category
}

export async function addAndLinkAssetDocumentLink(
  boatId: string,
  assetId: string,
  input: {
    url: string
    title?: string | null
    purpose?: DocumentPurpose | null
  },
): Promise<void> {
  const category = await defaultDocumentCategory(boatId)
  const url = input.url.trim()
  const title = resolveDocumentLinkTitle(url, { title: input.title })

  const document = await createBoatDocumentLink(boatId, {
    title,
    categoryId: category.id,
    url,
    purpose: input.purpose ?? 'other',
  })

  await linkBoatDocument(boatId, document.id, { assetId })
}

export async function fetchBoatAccounting(
  boatId: string,
): Promise<BoatAccountingSummary> {
  const data = await api<{ accounting: BoatAccountingSummary }>(
    `/api/boats/${boatId}/accounting`,
  )
  return data.accounting
}
