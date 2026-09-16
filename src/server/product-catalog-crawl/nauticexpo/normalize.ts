import { createHash } from 'node:crypto'
import { productIdentity } from '../../../domain/product-catalog'
import type { ParsedProduct } from './parsers'
import { NAUTICEXPO_SOURCE } from './constants'

export type StagedProduct = {
  brand: string
  modelNumber: string
  brandKey: string
  modelKey: string
  logoUrl: string | null
  imageUrls: string[]
  sourceUrl: string
  source: typeof NAUTICEXPO_SOURCE
  contentHash: string
  crawledAt: string
  nauticExpoManufacturerId: string | null
  nauticExpoProductId: string | null
}

export function hashStagedPayload(payload: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function normalizeParsedProduct(
  parsed: ParsedProduct,
  sourceUrl: string,
  crawledAt = new Date(),
): StagedProduct | null {
  if (!parsed.brand.trim() || !parsed.modelNumber.trim()) return null
  const identity = productIdentity(parsed.brand, parsed.modelNumber)
  if (!identity.brandKey || !identity.modelKey) return null

  const canonical = {
    brand: identity.brand,
    modelNumber: identity.modelNumber,
    logoUrl: parsed.logoUrl,
    imageUrls: [...parsed.imageUrls].sort(),
    nauticExpoManufacturerId: parsed.manufacturerId,
    nauticExpoProductId: parsed.productId,
  }

  return {
    brand: identity.brand,
    modelNumber: identity.modelNumber,
    brandKey: identity.brandKey,
    modelKey: identity.modelKey,
    logoUrl: parsed.logoUrl,
    imageUrls: parsed.imageUrls,
    sourceUrl,
    source: NAUTICEXPO_SOURCE,
    contentHash: hashStagedPayload(canonical),
    crawledAt: crawledAt.toISOString(),
    nauticExpoManufacturerId: parsed.manufacturerId,
    nauticExpoProductId: parsed.productId,
  }
}
