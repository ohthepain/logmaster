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

export function isSystemNetworkAsset(asset: { kind: BoatAssetKind }): boolean {
  return asset.kind === 'system_network'
}

export function connectionPeerKind(asset: {
  kind: BoatAssetKind
}): AssetConnectionPeer['kind'] {
  return isSystemNetworkAsset(asset) ? 'network' : 'equipment'
}

export function isBoatNetworkKey(value: unknown): value is BoatNetworkKey {
  return (
    typeof value === 'string' &&
    (BOAT_NETWORK_KEYS as readonly string[]).includes(value)
  )
}

export function boatNetworkLabel(key: BoatNetworkKey): string {
  return BOAT_NETWORK_DEFINITIONS.find((item) => item.key === key)?.name ?? key
}

export type ConnectedBoatNetwork = {
  assetId: string
  name: string
  networkKey: BoatNetworkKey
}

function sortConnectedBoatNetworks(
  byKey: Map<BoatNetworkKey, ConnectedBoatNetwork>,
): ConnectedBoatNetwork[] {
  return BOAT_NETWORK_DEFINITIONS.flatMap((def) => {
    const item = byKey.get(def.key)
    return item ? [item] : []
  })
}

/** Networks an equipment asset is directly connected to. */
export function connectedBoatNetworks(
  connections: ReadonlyArray<AssetConnectionDetail>,
): ConnectedBoatNetwork[] {
  const byKey = new Map<BoatNetworkKey, ConnectedBoatNetwork>()
  for (const item of connections) {
    if (item.peer.kind !== 'network' || !item.peer.networkKey) continue
    if (byKey.has(item.peer.networkKey)) continue
    byKey.set(item.peer.networkKey, {
      assetId: item.peer.assetId,
      name: item.peer.name || boatNetworkLabel(item.peer.networkKey),
      networkKey: item.peer.networkKey,
    })
  }
  return sortConnectedBoatNetworks(byKey)
}

/** System network assets currently listed with the boat (connected backbones). */
export function listedBoatNetworks(
  assets: ReadonlyArray<{
    id: string
    name: string
    kind?: 'equipment' | 'system_network'
    networkKey?: BoatNetworkKey | null
  }>,
): ConnectedBoatNetwork[] {
  const byKey = new Map<BoatNetworkKey, ConnectedBoatNetwork>()
  for (const asset of assets) {
    if (asset.kind !== 'system_network' || !asset.networkKey) continue
    byKey.set(asset.networkKey, {
      assetId: asset.id,
      name: asset.name || boatNetworkLabel(asset.networkKey),
      networkKey: asset.networkKey,
    })
  }
  return sortConnectedBoatNetworks(byKey)
}

export function validateAssetConnection(
  connectionType: AssetConnectionType,
  left: { id: string; kind: BoatAssetKind; boatId: string },
  right: { id: string; kind: BoatAssetKind; boatId: string },
): string | null {
  if (left.id === right.id) return 'Choose a different peer.'
  if (left.boatId !== right.boatId) return 'Connections must stay on this boat.'
  if (isSystemNetworkAsset(left) && isSystemNetworkAsset(right)) {
    if (connectionType !== 'cable') {
      return 'Boat networks can only be linked with a cable connection.'
    }
    return null
  }
  const hasNetwork = isSystemNetworkAsset(left) || isSystemNetworkAsset(right)
  if (
    (connectionType === 'wifi' || connectionType === 'bluetooth') &&
    hasNetwork
  ) {
    return 'Wi‑Fi and Bluetooth connections are only between equipment.'
  }
  return null
}
