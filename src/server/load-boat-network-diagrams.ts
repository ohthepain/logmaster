import { getAssetIdentity } from '../domain/asset-brands'
import type {
  BoatNetworkDiagram,
  BoatNetworkDiagramDevice,
} from '../domain/boat-network-diagram'
import type {
  AssetConnectionType,
  BoatNetworkKey,
} from '../domain/asset-connections'
import {
  directEquipmentOnNetwork,
  linkedNetworksFor,
  networkHasAnyActivity,
  possibleEquipmentOnNetwork,
} from '../domain/boat-network-graph'
import type {
  BoatNetworkGraphConnection,
  BoatNetworkGraphEquipment,
} from '../domain/boat-network-graph'
import { catalogProductImageUrl } from './asset-cover-photo'
import { ensureBoatNetworkAssets } from './boat-network-assets'
import { loadProductNetworks } from './product-networks'
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
  return catalogProductImageUrl(productId, product ?? null)
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
    byId.set(
      row.toAsset.id,
      serializeDevice(row.toAsset, {
        connectionId: row.id,
        connectionType: row.connectionType,
      }),
    )
  }
  for (const row of connectionsTo) {
    if (row.fromAsset.kind !== 'equipment') continue
    if (!byId.has(row.fromAsset.id)) {
      byId.set(
        row.fromAsset.id,
        serializeDevice(row.fromAsset, {
          connectionId: row.id,
          connectionType: row.connectionType,
        }),
      )
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
}

function serializeDevice(
  asset: EquipmentAsset,
  connection: { connectionId: string; connectionType: string },
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
    connectionId: connection.connectionId,
    connectionType: connection.connectionType as AssetConnectionType,
  }
}

export async function loadBoatNetworkDiagrams(
  boatId: string,
): Promise<BoatNetworkDiagram[]> {
  await ensureBoatNetworkAssets(boatId)

  const [networkRows, equipmentRows, connectionRows] = await Promise.all([
    prisma.boatAsset.findMany({
      where: { boatId, kind: 'system_network' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, networkKey: true },
    }),
    prisma.boatAsset.findMany({
      where: { boatId, kind: 'equipment' },
      select: {
        id: true,
        name: true,
        brand: true,
        modelNumber: true,
        productId: true,
        kind: true,
        ...equipmentProductInclude,
      },
    }),
    prisma.assetConnection.findMany({
      where: { boatId },
      select: {
        id: true,
        connectionType: true,
        fromAsset: { select: { id: true, kind: true } },
        toAsset: { select: { id: true, kind: true } },
      },
    }),
  ])

  const equipmentById = new Map(equipmentRows.map((row) => [row.id, row]))
  const graphConnections: BoatNetworkGraphConnection[] = connectionRows.map(
    (row) => ({
      id: row.id,
      connectionType: row.connectionType,
      fromAssetId: row.fromAsset.id,
      fromKind: row.fromAsset.kind,
      toAssetId: row.toAsset.id,
      toKind: row.toAsset.kind,
    }),
  )

  const productIds = [
    ...new Set(
      equipmentRows
        .map((row) => row.productId)
        .filter((id): id is string => !!id),
    ),
  ]
  const productNetworkMap = new Map<string, Set<BoatNetworkKey>>()
  await Promise.all(
    productIds.map(async (productId) => {
      const networks = await loadProductNetworks(productId)
      productNetworkMap.set(
        productId,
        new Set(networks.map((item) => item.networkKey)),
      )
    }),
  )

  const graphEquipment: BoatNetworkGraphEquipment[] = equipmentRows.map(
    (row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      modelNumber: row.modelNumber,
      productNetworkKeys: row.productId
        ? (productNetworkMap.get(row.productId) ?? null)
        : null,
    }),
  )

  const networks = networkRows
    .filter((row) => row.networkKey != null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      networkKey: row.networkKey as BoatNetworkKey,
    }))

  return networks
    .filter((network) => networkHasAnyActivity(network.id, graphConnections))
    .map((network) => {
      const direct = directEquipmentOnNetwork(network.id, graphConnections)
      const devices = [...direct.entries()]
        .map(([assetId, link]) => {
          const asset = equipmentById.get(assetId)
          if (!asset) return null
          return serializeDevice(asset, {
            connectionId: link.connectionId,
            connectionType: link.connectionType,
          })
        })
        .filter((item): item is BoatNetworkDiagramDevice => !!item)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        )

      return {
        networkAssetId: network.id,
        networkKey: network.networkKey,
        name: network.name,
        devices,
        linkedNetworks: linkedNetworksFor(
          network.id,
          networks,
          graphConnections,
        ),
        possibleDevices: possibleEquipmentOnNetwork({
          targetNetwork: network,
          networks,
          equipment: graphEquipment,
          connections: graphConnections,
        }),
      }
    })
}
