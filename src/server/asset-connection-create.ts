import type { AssetConnectionType, Prisma } from '../../generated/prisma/client'
import { validateAssetConnection } from '../domain/asset-connections'
import { prisma } from './db'

export async function createAssetConnection(
  boatId: string,
  userId: string,
  leftId: string,
  rightId: string,
  connectionType: AssetConnectionType,
  reason: string,
  db: Pick<typeof prisma, 'boatAsset' | 'assetConnection'> = prisma,
) {
  const assets = await db.boatAsset.findMany({
    where: { boatId, id: { in: [leftId, rightId] } },
    select: { id: true, kind: true, boatId: true },
  })
  const left = assets.find((item) => item.id === leftId)
  const right = assets.find((item) => item.id === rightId)
  if (!left || !right)
    throw new Error('Connection peer not found on this boat.')
  const error = validateAssetConnection(connectionType, left, right)
  if (error) throw new Error(error)
  const [fromAssetId, toAssetId] = [leftId, rightId].sort()
  return db.assetConnection.upsert({
    where: { fromAssetId_toAssetId: { fromAssetId, toAssetId } },
    create: {
      boatId,
      fromAssetId,
      toAssetId,
      connectionType,
      reason,
      confirmedBy: userId,
    },
    update: {
      connectionType,
      reason,
    },
  })
}

export async function createAssetConnectionInTx(
  tx: Prisma.TransactionClient,
  boatId: string,
  userId: string,
  leftId: string,
  rightId: string,
  connectionType: AssetConnectionType,
  reason: string,
) {
  const assets = await tx.boatAsset.findMany({
    where: { boatId, id: { in: [leftId, rightId] } },
    select: { id: true, kind: true, boatId: true },
  })
  const left = assets.find((item) => item.id === leftId)
  const right = assets.find((item) => item.id === rightId)
  if (!left || !right) {
    throw new Error(
      'A connected asset no longer exists on this boat. Review the connections and try again.',
    )
  }
  const error = validateAssetConnection(connectionType, left, right)
  if (error) throw new Error(error)
  const [fromAssetId, toAssetId] = [leftId, rightId].sort()
  await tx.assetConnection.upsert({
    where: { fromAssetId_toAssetId: { fromAssetId, toAssetId } },
    create: {
      boatId,
      fromAssetId,
      toAssetId,
      connectionType,
      reason,
      confirmedBy: userId,
    },
    update: {},
  })
}
