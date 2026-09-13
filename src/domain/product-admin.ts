import type { ProductInfo, ProductResource } from './product-catalog'

export type ProductAdminSummary = {
  id: string
  brand: string
  modelNumber: string
  reviewStatus: string
  name: string
  languages: string[]
  resourceCount: number
  updatedAt: string
}

export type ProductAdminDetail = {
  id: string
  brand: string
  modelNumber: string
  reviewStatus: string
  canonicalImageId: string | null
  aliases: string[]
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  locales: Array<{
    language: string
    status: string
    error: string | null
    researchedAt: string | null
    updatedAt: string
    info: ProductInfo | null
    researchDocuments: unknown[]
  }>
  resources: Array<
    ProductResource & {
      mimeType: string | null
      cached: boolean
      imageUrl: string | null
      createdAt: string
      updatedAt: string
    }
  >
}

export type ProductAdminEdit = {
  updatedAt: string
  brand: string
  modelNumber: string
  reviewStatus: string
  canonicalImageId: string | null
  aliases: string[]
  locales: Array<{
    language: string
    updatedAt: string | null
    info: ProductInfo
  }>
  resources: Array<
    Pick<
      ProductResource,
      | 'title'
      | 'sourceUrl'
      | 'purpose'
      | 'languages'
      | 'revision'
      | 'modelNumbers'
      | 'reason'
      | 'reviewStatus'
    > & { id?: string }
  >
}
