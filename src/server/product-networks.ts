import { prisma } from './db'
import { parseProductNetworkConnections } from '../domain/product-networks'
import type { ProductNetworkConnection } from '../domain/product-networks'

type NetworkDb = {
  catalogProductNetwork: {
    findMany: (typeof prisma)['catalogProductNetwork']['findMany']
    deleteMany: (typeof prisma)['catalogProductNetwork']['deleteMany']
    createMany: (typeof prisma)['catalogProductNetwork']['createMany']
  }
}

export function serializeProductNetworks(
  rows: Array<{
    networkKey: ProductNetworkConnection['networkKey']
    portCount: number | null
  }>,
): ProductNetworkConnection[] {
  return parseProductNetworkConnections(
    [],
    rows.map((row) => ({
      networkKey: row.networkKey,
      portCount: row.portCount,
    })),
  )
}

export async function loadProductNetworks(
  productId: string,
  db: NetworkDb = prisma,
) {
  return serializeProductNetworks(
    await db.catalogProductNetwork.findMany({ where: { productId } }),
  )
}

export async function replaceProductNetworks(
  productId: string,
  connections: ProductNetworkConnection[],
  db: NetworkDb = prisma,
) {
  await db.catalogProductNetwork.deleteMany({ where: { productId } })
  if (connections.length) {
    await db.catalogProductNetwork.createMany({
      data: connections.map((item) => ({
        productId,
        networkKey: item.networkKey,
        portCount: item.portCount,
      })),
    })
  }
  return connections
}

export async function ensureProductNetworksFromSpecs(
  productId: string,
  specifications: Array<{ name: string; value: string; unit?: string | null }>,
  extra: ProductNetworkConnection[] = [],
  db: NetworkDb = prisma,
) {
  const existing = await db.catalogProductNetwork.findMany({
    where: { productId },
  })
  if (existing.length) return serializeProductNetworks(existing)
  const parsed = parseProductNetworkConnections(specifications, extra)
  if (!parsed.length) return []
  await db.catalogProductNetwork.createMany({
    data: parsed.map((item) => ({
      productId,
      networkKey: item.networkKey,
      portCount: item.portCount,
    })),
    skipDuplicates: true,
  })
  return loadProductNetworks(productId, db)
}
