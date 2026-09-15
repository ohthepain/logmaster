import type { BoatNetworkKey } from '../domain/asset-connections'
import { buildNetworkConnectionCandidates } from '../domain/network-connection-candidates'
import type { NetworkConnectionCandidates } from '../domain/network-connection-candidates'
import { ensureBoatNetworkAssets } from './boat-network-assets'
import { loadProductNetworks } from './product-networks'
import { prisma } from './db'

function equipmentIdsOnNetwork(
  connectionsFrom: Array<{ toAsset: { id: string; kind: string } }>,
  connectionsTo: Array<{ fromAsset: { id: string; kind: string } }>,
): Set<string> {
  const ids = new Set<string>()
  for (const row of connectionsFrom) {
    if (row.toAsset.kind === 'equipment') ids.add(row.toAsset.id)
  }
  for (const row of connectionsTo) {
    if (row.fromAsset.kind === 'equipment') ids.add(row.fromAsset.id)
  }
  return ids
}

function connectedPeerIds(
  connectionsFrom: Array<{ toAsset: { id: string } }>,
  connectionsTo: Array<{ fromAsset: { id: string } }>,
): Set<string> {
  const ids = new Set<string>()
  for (const row of connectionsFrom) ids.add(row.toAsset.id)
  for (const row of connectionsTo) ids.add(row.fromAsset.id)
  return ids
}

export async function loadNetworkConnectionCandidates(
  boatId: string,
  networkAssetId: string,
): Promise<NetworkConnectionCandidates | null> {
  await ensureBoatNetworkAssets(boatId)

  const target = await prisma.boatAsset.findFirst({
    where: { id: networkAssetId, boatId, kind: 'system_network' },
    select: {
      id: true,
      networkKey: true,
      connectionsFrom: {
        select: { toAsset: { select: { id: true, kind: true } } },
      },
      connectionsTo: {
        select: { fromAsset: { select: { id: true, kind: true } } },
      },
    },
  })
  if (!target?.networkKey) return null

  const [networkRows, equipmentRows] = await Promise.all([
    prisma.boatAsset.findMany({
      where: { boatId, kind: 'system_network' },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        networkKey: true,
        connectionsFrom: {
          select: { toAsset: { select: { id: true, kind: true } } },
        },
        connectionsTo: {
          select: { fromAsset: { select: { id: true, kind: true } } },
        },
      },
    }),
    prisma.boatAsset.findMany({
      where: { boatId, kind: 'equipment' },
      select: {
        id: true,
        name: true,
        brand: true,
        modelNumber: true,
        productId: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

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

  const connectedToTarget = connectedPeerIds(
    target.connectionsFrom,
    target.connectionsTo,
  )

  const equipmentNetworkIds = new Map<string, Set<string>>()
  for (const row of networkRows) {
    for (const id of equipmentIdsOnNetwork(
      row.connectionsFrom,
      row.connectionsTo,
    )) {
      const set = equipmentNetworkIds.get(id) ?? new Set<string>()
      set.add(row.id)
      equipmentNetworkIds.set(id, set)
    }
  }

  return buildNetworkConnectionCandidates({
    targetNetworkId: target.id,
    targetNetworkKey: target.networkKey,
    connectedToTarget,
    allNetworks: networkRows
      .filter((row) => row.networkKey != null)
      .map((row) => ({
        id: row.id,
        name: row.name,
        networkKey: row.networkKey as BoatNetworkKey,
        equipmentIds: equipmentIdsOnNetwork(
          row.connectionsFrom,
          row.connectionsTo,
        ),
      })),
    equipment: equipmentRows.map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      modelNumber: row.modelNumber,
      productNetworkKeys: row.productId
        ? (productNetworkMap.get(row.productId) ?? null)
        : null,
      networkIds: equipmentNetworkIds.get(row.id) ?? new Set<string>(),
    })),
  })
}
