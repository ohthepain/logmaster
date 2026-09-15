import { getAssetIdentity } from '../domain/asset-brands'
import type {
  BoatNetworkDiagram,
  BoatNetworkDiagramDevice,
} from '../domain/boat-network-diagram'
import type { AssetConnectionType } from '../domain/asset-connections'
import { ensureBoatNetworkAssets } from './boat-network-assets'
import { prisma } from './db'

const equipmentProductInclude = {
  product: {
    include: {
      resources: {
        where: { reviewStatus: 'verified' as const, purpose: 'photo' as const },
        select: { id: true, displayS3Key: true, reviewStatus: true },
      },
    },
  },
} as const

type EquipmentAsset = {
  id: string
  name: string
  brand: string | null
  modelNumber: string | null
  productId: string | null
  kind: 'equipment' | 'system_network'
  product?: {
    reviewStatus: string
    canonicalImageId: string | null
    resources: Array<{
      id: string
      displayS3Key: string | null
      reviewStatus: string
    }>
  } | null
}

export function productImageUrlForEquipment(
  productId: string | null,
  product: EquipmentAsset['product'],
): string | null {
  if (!productId || !product || product.reviewStatus === 'rejected') {
    return null
  }
  const canonicalId = product.canonicalImageId
  if (!canonicalId) return null
  const resource = product.resources.find((r) => r.id === canonicalId)
  if (
    !resource ||
    resource.reviewStatus !== 'verified' ||
    !resource.displayS3Key
  ) {
    return null
  }
  return `/api/products/${productId}/resources/${canonicalId}/content?display=1`
}

export function devicesOnNetworkFromConnections(
  connectionsFrom: Array<{
    id: string
    connectionType: AssetConnectionType
    toAsset: EquipmentAsset
  }>,
  connectionsTo: Array<{
    id: string
    connectionType: AssetConnectionType
    fromAsset: EquipmentAsset
  }>,
): BoatNetworkDiagramDevice[] {
  const byId = new Map<string, BoatNetworkDiagramDevice>()
  for (const row of connectionsFrom) {
    if (row.toAsset.kind !== 'equipment') continue
    byId.set(row.toAsset.id, serializeDevice(row.toAsset, row))
  }
  for (const row of connectionsTo) {
    if (row.fromAsset.kind !== 'equipment') continue
    if (!byId.has(row.fromAsset.id)) {
      byId.set(row.fromAsset.id, serializeDevice(row.fromAsset, row))
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
}

function serializeDevice(
  asset: EquipmentAsset,
  connection: { id: string; connectionType: AssetConnectionType },
): BoatNetworkDiagramDevice {
  const identity = getAssetIdentity(asset)
  return {
    assetId: asset.id,
    name: asset.name,
    brand: identity.brand,
    modelNumber: identity.modelNumber,
    productImageUrl: productImageUrlForEquipment(
      asset.productId,
      asset.product ?? null,
    ),
    connectionId: connection.id,
    connectionType: connection.connectionType,
  }
}

const visibleNetworksWhere = (boatId: string) => ({
  boatId,
  kind: 'system_network' as const,
  OR: [
    {
      connectionsFrom: {
        some: { toAsset: { kind: 'equipment' as const, boatId } },
      },
    },
    {
      connectionsTo: {
        some: { fromAsset: { kind: 'equipment' as const, boatId } },
      },
    },
  ],
})

export async function loadBoatNetworkDiagrams(
  boatId: string,
): Promise<BoatNetworkDiagram[]> {
  await ensureBoatNetworkAssets(boatId)

  const networks = await prisma.boatAsset.findMany({
    where: visibleNetworksWhere(boatId),
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      networkKey: true,
      connectionsFrom: {
        where: { toAsset: { kind: 'equipment', boatId } },
        select: {
          id: true,
          connectionType: true,
          toAsset: {
            select: {
              id: true,
              name: true,
              brand: true,
              modelNumber: true,
              productId: true,
              kind: true,
              ...equipmentProductInclude,
            },
          },
        },
      },
      connectionsTo: {
        where: { fromAsset: { kind: 'equipment', boatId } },
        select: {
          id: true,
          connectionType: true,
          fromAsset: {
            select: {
              id: true,
              name: true,
              brand: true,
              modelNumber: true,
              productId: true,
              kind: true,
              ...equipmentProductInclude,
            },
          },
        },
      },
    },
  })

  return networks
    .filter((n) => n.networkKey != null)
    .map((network) => ({
      networkAssetId: network.id,
      networkKey: network.networkKey!,
      name: network.name,
      devices: devicesOnNetworkFromConnections(
        network.connectionsFrom,
        network.connectionsTo,
      ),
    }))
}
