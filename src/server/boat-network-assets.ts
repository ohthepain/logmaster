import type { Prisma } from '../../generated/prisma/client'
import {
  BOAT_NETWORK_DEFINITIONS,
  systemNetworkAssetId,
} from '../domain/asset-connections'
import { prisma } from './db'

export async function ensureBoatNetworkAssets(
  boatId: string,
  db: Pick<typeof prisma, 'boatAsset'> = prisma,
) {
  for (const network of BOAT_NETWORK_DEFINITIONS) {
    await db.boatAsset.upsert({
      where: {
        boatId_networkKey: { boatId, networkKey: network.key },
      },
      create: {
        id: systemNetworkAssetId(boatId, network.key),
        boatId,
        kind: 'system_network',
        networkKey: network.key,
        name: network.name,
        ownership: 'BOAT',
        sortOrder: network.sortOrder,
      },
      update: {
        name: network.name,
        kind: 'system_network',
        sortOrder: network.sortOrder,
      },
    })
  }
}

/** Prisma filter: equipment plus system networks that have ≥1 equipment link. */
export function listableBoatAssetsWhere(boatId: string): Prisma.BoatAssetWhereInput {
  return {
    boatId,
    OR: [
      { kind: 'equipment' },
      {
        kind: 'system_network',
        OR: [
          {
            connectionsFrom: {
              some: { toAsset: { kind: 'equipment', boatId } },
            },
          },
          {
            connectionsTo: {
              some: { fromAsset: { kind: 'equipment', boatId } },
            },
          },
        ],
      },
    ],
  }
}

export function visibleSystemNetworkWhere(
  boatId: string,
  assetId: string,
): Prisma.BoatAssetWhereInput {
  return {
    id: assetId,
    boatId,
    kind: 'system_network',
    OR: [
      {
        connectionsFrom: {
          some: { toAsset: { kind: 'equipment', boatId } },
        },
      },
      {
        connectionsTo: {
          some: { fromAsset: { kind: 'equipment', boatId } },
        },
      },
    ],
  }
}

export async function isSystemNetworkVisible(
  boatId: string,
  assetId: string,
): Promise<boolean> {
  const row = await prisma.boatAsset.findFirst({
    where: visibleSystemNetworkWhere(boatId, assetId),
    select: { id: true },
  })
  return !!row
}
