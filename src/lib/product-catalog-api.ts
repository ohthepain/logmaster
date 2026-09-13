import { apiUrl } from './app-origin'
import type { CatalogProduct } from '../domain/product-catalog'
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

export async function productApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(apiUrl(`/api/products${path}`), {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json()
  if (!response.ok)
    throw new Error(body.error ?? 'Product catalog unavailable.')
  return body as T
}
export async function findCatalogProducts(
  brand: string,
  model: string,
  language: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ brand, model, language })
  return productApi<{ products: CatalogProduct[]; exact: boolean }>(
    `?${params}`,
    { signal },
  )
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
