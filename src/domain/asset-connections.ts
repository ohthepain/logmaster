import type {
  AssetConnectionType,
  BoatAssetKind,
  BoatNetworkKey,
} from '../../generated/prisma/client'

export type { AssetConnectionType, BoatNetworkKey }

export const ASSET_CONNECTION_TYPES = [
  'cable',
  'wifi',
  'bluetooth',
  'nmea0183',
] as const satisfies readonly AssetConnectionType[]

export const BOAT_NETWORK_KEYS = [
  'nmea_2000',
  'seatal_k1',
  'seatal_kng',
  'ethernet',
] as const satisfies readonly BoatNetworkKey[]

export const BOAT_NETWORK_DEFINITIONS: ReadonlyArray<{
  key: BoatNetworkKey
  name: string
  sortOrder: number
}> = [
  { key: 'nmea_2000', name: 'NMEA 2000', sortOrder: -400 },
  { key: 'seatal_k1', name: 'SeaTalk1', sortOrder: -300 },
  { key: 'seatal_kng', name: 'SeaTalkNG', sortOrder: -200 },
  { key: 'ethernet', name: 'Ethernet', sortOrder: -100 },
]

export const ASSET_CONNECTION_TYPE_LABELS: Record<AssetConnectionType, string> =
  {
    cable: 'Cable',
    wifi: 'Wi‑Fi',
    bluetooth: 'Bluetooth',
    nmea0183: 'NMEA 0183',
  }

export type AssetConnectionPeer = {
  kind: 'equipment' | 'network'
  assetId: string
  name: string
  networkKey?: BoatNetworkKey
}

export type AssetConnectionDetail = {
  id: string
  connectionType: AssetConnectionType
  reason: string
  peer: AssetConnectionPeer
}

export function systemNetworkAssetId(
  boatId: string,
  networkKey: BoatNetworkKey,
): string {
  return `net_${boatId}_${networkKey}`
}

export function isSystemNetworkAsset(asset: {
  kind: BoatAssetKind
}): boolean {
  return asset.kind === 'system_network'
}

export function connectionPeerKind(asset: {
  kind: BoatAssetKind
}): AssetConnectionPeer['kind'] {
  return isSystemNetworkAsset(asset) ? 'network' : 'equipment'
}

export function validateAssetConnection(
  connectionType: AssetConnectionType,
  left: { id: string; kind: BoatAssetKind; boatId: string },
  right: { id: string; kind: BoatAssetKind; boatId: string },
): string | null {
  if (left.id === right.id) return 'Choose a different peer.'
  if (left.boatId !== right.boatId) return 'Connections must stay on this boat.'
  if (
    isSystemNetworkAsset(left) &&
    isSystemNetworkAsset(right)
  ) {
    return 'Networks cannot connect directly to each other.'
  }
  const hasNetwork =
    isSystemNetworkAsset(left) || isSystemNetworkAsset(right)
  if (
    (connectionType === 'wifi' || connectionType === 'bluetooth') &&
    hasNetwork
  ) {
    return 'Wi‑Fi and Bluetooth connections are only between equipment.'
  }
  return null
}
