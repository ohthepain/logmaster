import { apiJson } from './api-client'
import type { CatalogProduct } from '../domain/product-catalog'
import type { EquipmentModelSuggestResult } from '../domain/equipment-model-option'
import type {
  ProductAdminDetail,
  ProductAdminEdit,
  ProductAdminSummary,
} from '../domain/product-admin'

export type ProductAdminSearch = {
  products: ProductAdminSummary[]
  total: number
  page: number
  pageSize: number
}
export function searchSharedProducts(
  q: string,
  status: string,
  page: number,
  signal?: AbortSignal,
) {
  return productApi<ProductAdminSearch>(
    `/admin?${new URLSearchParams({ q, status, page: String(page) })}`,
    { signal },
  )
}
export async function fetchAdminProduct(id: string, signal?: AbortSignal) {
  return (
    await productApi<{ product: ProductAdminDetail }>(
      `/admin/${encodeURIComponent(id)}`,
      { signal },
    )
  ).product
}
export async function saveAdminProduct(id: string, input: ProductAdminEdit) {
  return (
    await productApi<{ product: ProductAdminDetail }>(
      `/admin/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    )
  ).product
}

/** Download (if needed), verify, and pin a catalog photo as the default display image. */
export async function confirmAdminProductPhoto(
  productId: string,
  resourceId: string,
) {
  return (
    await productApi<{ product: CatalogProduct }>(
      `/${encodeURIComponent(productId)}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          imageId: resourceId,
          resourceId,
          resourceStatus: 'verified',
        }),
      },
    )
  ).product
}
export async function regenerateAdminProduct(id: string, language: string) {
  return (
    await productApi<{ product: ProductAdminDetail }>(
      `/admin/${encodeURIComponent(id)}/research`,
      { method: 'POST', body: JSON.stringify({ language }) },
    )
  ).product
}

export async function productApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return apiJson<T>(`/api/products${path}`, init)
}
export async function findCatalogBrands(q: string, signal?: AbortSignal) {
  return (
    await productApi<{ brands: Array<{ name: string; logo: string | null }> }>(
      `/brands?${new URLSearchParams({ q })}`,
      { signal },
    )
  ).brands
}
export function resolveEquipmentProduct(
  brand: string,
  model: string,
  language: string,
  signal?: AbortSignal,
  hints?: {
    sourceUrl?: string
    photoUrl?: string | null
    productId?: string
  },
) {
  return productApi<{
    product: CatalogProduct
    pending: boolean
    notice: string
  }>('/resolve', {
    method: 'POST',
    body: JSON.stringify({
      brand,
      model,
      language,
      ...(hints?.productId ? { productId: hints.productId } : {}),
      ...(hints?.sourceUrl ? { sourceUrl: hints.sourceUrl } : {}),
      ...(hints?.photoUrl ? { photoUrl: hints.photoUrl } : {}),
    }),
    signal,
  })
}
export async function fetchEquipmentModelOptions(
  brand: string,
  query: string,
  signal?: AbortSignal,
) {
  return productApi<EquipmentModelSuggestResult>('/model-options', {
    method: 'POST',
    body: JSON.stringify({ brand, query }),
    signal,
  })
}
export async function findCatalogProducts(
  brand: string,
  model: string,
  language: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ brand, model, language })
  return productApi<{
    products: CatalogProduct[]
    exact: boolean
    ambiguous: boolean
  }>(`?${params}`, { signal })
}

export async function findCatalogModels(
  brand: string,
  query: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ brand, q: query })
  return (
    await productApi<{ models: string[] }>(`/models?${params}`, { signal })
  ).models
}
export async function fetchCatalogProduct(
  id: string,
  language: string,
  signal?: AbortSignal,
) {
  return (
    await productApi<{ product: CatalogProduct }>(
      `/${encodeURIComponent(id)}?language=${encodeURIComponent(language)}`,
      { signal },
    )
  ).product
}
