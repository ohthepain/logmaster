import { findProduct } from './product-catalog'
import { ensureBoatNetworkAssets } from './boat-network-assets'
import {
  ensureProductNetworksFromSpecs,
  loadProductNetworks,
} from './product-networks'
import { productResearchSchema } from './product-research'
import { prisma } from './db'
import { productNetworkConnectionReason } from '../domain/product-networks'
import type { ProductNetworkConnection } from '../domain/product-networks'
import type { AssetConnectionSuggestion } from '../domain/asset-intelligence'

async function productNetworksForIdentity(input: {
  productId?: string
  brand?: string | null
  modelNumber?: string | null
}): Promise<{ productId: string; networks: ProductNetworkConnection[] } | null> {
  const row = input.productId
    ? await prisma.catalogProduct.findUnique({
        where: { id: input.productId },
        include: { locales: true, networks: true },
      })
    : input.brand && input.modelNumber
      ? await findProduct(input.brand, input.modelNumber).then((product) =>
          product
            ? prisma.catalogProduct.findUnique({
                where: { id: product.id },
                include: { locales: true, networks: true },
              })
            : null,
        )
      : null
  if (!row || row.reviewStatus === 'rejected') return null
  if (row.networks.length) {
    return {
      productId: row.id,
      networks: await loadProductNetworks(row.id),
    }
  }
  const english =
    row.locales.find((locale) => locale.language === 'en') ?? row.locales[0]
  const parsed = productResearchSchema.safeParse(english?.result)
  const networks = await ensureProductNetworksFromSpecs(
    row.id,
    parsed.success ? parsed.data.specifications : [],
  )
  return { productId: row.id, networks }
}

export async function suggestProductNetworkConnections(
  boatId: string,
  input: {
    productId?: string
    brand?: string | null
    modelNumber?: string | null
  },
): Promise<AssetConnectionSuggestion[]> {
  const resolved = await productNetworksForIdentity(input)
  if (!resolved?.networks.length) return []
  await ensureBoatNetworkAssets(boatId)
  const assets = await prisma.boatAsset.findMany({
    where: {
      boatId,
      kind: 'system_network',
      networkKey: { in: resolved.networks.map((item) => item.networkKey) },
    },
    select: { id: true, name: true, networkKey: true },
  })
  return resolved.networks.flatMap((connection) => {
    const asset = assets.find((item) => item.networkKey === connection.networkKey)
    if (!asset) return []
    return [
      {
        assetId: asset.id,
        name: asset.name,
        kind: 'network' as const,
        connectionType: 'cable' as const,
        reason: productNetworkConnectionReason(connection),
      },
    ]
  })
}
