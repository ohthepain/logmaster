import {
  ensureProductResearch,
  getProduct,
  resolveProduct,
} from './product-catalog'
import { researchAsset, researchAssetConnections } from './asset-intelligence'
import type { z } from 'zod'
import type { researchInputSchema } from './asset-intelligence-schema'
import type { AssetResearch } from '../domain/asset-intelligence'

export async function researchCatalogAsset(
  input: z.infer<typeof researchInputSchema>,
  assets: Parameters<typeof researchAsset>[1],
  connections: Parameters<typeof researchAsset>[2],
): Promise<AssetResearch> {
  // Unidentified equipment can still be researched privately; it cannot create
  // a global product based on a user's personal description.
  if (
    input.sharedProduct === false ||
    !input.brand?.trim() ||
    !input.modelNumber
  ) {
    return researchAsset(input, assets, connections)
  }
  const product = await resolveProduct(
    input.brand,
    input.modelNumber,
    input.productId,
  )
  const result = await ensureProductResearch(product.id, input.language)
  const current = await getProduct(product.id, input.language)
  if (!current) throw new Error('This product is no longer available.')
  const privateConnections = input.includeConnections
    ? await researchAssetConnections(input, assets, connections)
    : []
  return {
    productId: product.id,
    category: result.category,
    downloads: current.resources.slice(0, 8).map((item) => ({
      title: item.title,
      url: item.sourceUrl,
      purpose:
        item.purpose === 'manual' ||
        item.purpose === 'photo' ||
        item.purpose === 'warranty'
          ? item.purpose
          : 'other',
      reason: item.reason,
    })),
    connections: privateConnections,
  }
}
