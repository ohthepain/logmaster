import type { BoatNetworkKey } from './asset-connections'
import { equipmentSupportsBoatNetwork } from './network-connection-candidates'

export type BoatNetworkGraphConnection = {
  id: string
  connectionType: string
  fromAssetId: string
  fromKind: 'equipment' | 'system_network'
  toAssetId: string
  toKind: 'equipment' | 'system_network'
}

export type BoatNetworkGraphNetwork = {
  id: string
  name: string
  networkKey: BoatNetworkKey
}

export type BoatNetworkGraphEquipment = {
  id: string
  name: string
  brand: string | null
  modelNumber: string | null
  productNetworkKeys: Set<BoatNetworkKey> | null
}

export type BoatNetworkDiagramLink = {
  networkAssetId: string
  name: string
  connectionId: string
  connectionType: string
}

export type BoatNetworkPossibleDevice = {
  assetId: string
  name: string
  brand: string | null
  modelNumber: string | null
  /** How this equipment could join the target network. */
  via: 'linked_network' | 'catalog'
  viaNetworkName?: string
}

function networkAdjacency(
  connections: BoatNetworkGraphConnection[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    const left = adj.get(a) ?? new Set<string>()
    left.add(b)
    adj.set(a, left)
    const right = adj.get(b) ?? new Set<string>()
    right.add(a)
    adj.set(b, right)
  }
  for (const row of connections) {
    if (
      row.fromKind === 'system_network' &&
      row.toKind === 'system_network'
    ) {
      link(row.fromAssetId, row.toAssetId)
    }
  }
  return adj
}

export function networksReachableFrom(
  startNetworkId: string,
  adjacency: Map<string, Set<string>>,
): Set<string> {
  const seen = new Set<string>()
  const queue = [startNetworkId]
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const next of adjacency.get(id) ?? []) {
      if (!seen.has(next)) queue.push(next)
    }
  }
  return seen
}

export function directEquipmentOnNetwork(
  networkId: string,
  connections: BoatNetworkGraphConnection[],
): Map<string, { connectionId: string; connectionType: string }> {
  const byEquipment = new Map<
    string,
    { connectionId: string; connectionType: string }
  >()
  for (const row of connections) {
    if (
      row.fromAssetId === networkId &&
      row.toKind === 'equipment'
    ) {
      byEquipment.set(row.toAssetId, {
        connectionId: row.id,
        connectionType: row.connectionType,
      })
    }
    if (
      row.toAssetId === networkId &&
      row.fromKind === 'equipment'
    ) {
      if (!byEquipment.has(row.fromAssetId)) {
        byEquipment.set(row.fromAssetId, {
          connectionId: row.id,
          connectionType: row.connectionType,
        })
      }
    }
  }
  return byEquipment
}

export function linkedNetworksFor(
  networkId: string,
  networks: BoatNetworkGraphNetwork[],
  connections: BoatNetworkGraphConnection[],
): BoatNetworkDiagramLink[] {
  const byId = new Map(networks.map((item) => [item.id, item]))
  const links: BoatNetworkDiagramLink[] = []
  for (const row of connections) {
    if (
      row.fromKind !== 'system_network' ||
      row.toKind !== 'system_network'
    ) {
      continue
    }
    if (row.fromAssetId === networkId) {
      const peer = byId.get(row.toAssetId)
      if (peer) {
        links.push({
          networkAssetId: peer.id,
          name: peer.name,
          connectionId: row.id,
          connectionType: row.connectionType,
        })
      }
    }
    if (row.toAssetId === networkId) {
      const peer = byId.get(row.fromAssetId)
      if (peer) {
        links.push({
          networkAssetId: peer.id,
          name: peer.name,
          connectionId: row.id,
          connectionType: row.connectionType,
        })
      }
    }
  }
  return links.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
}

export function equipmentDirectNetworkIds(
  equipmentId: string,
  connections: BoatNetworkGraphConnection[],
): Set<string> {
  const ids = new Set<string>()
  for (const row of connections) {
    if (row.fromAssetId === equipmentId && row.toKind === 'system_network') {
      ids.add(row.toAssetId)
    }
    if (row.toAssetId === equipmentId && row.fromKind === 'system_network') {
      ids.add(row.fromAssetId)
    }
  }
  return ids
}

export function possibleEquipmentOnNetwork(input: {
  targetNetwork: BoatNetworkGraphNetwork
  networks: BoatNetworkGraphNetwork[]
  equipment: BoatNetworkGraphEquipment[]
  connections: BoatNetworkGraphConnection[]
}): BoatNetworkPossibleDevice[] {
  const { targetNetwork, networks, equipment, connections } = input
  const direct = directEquipmentOnNetwork(targetNetwork.id, connections)
  const adj = networkAdjacency(connections)
  const reachableNetworks = networksReachableFrom(targetNetwork.id, adj)
  const networkName = new Map(networks.map((item) => [item.id, item.name]))
  const possible: BoatNetworkPossibleDevice[] = []
  const seen = new Set<string>()

  for (const item of equipment) {
    if (direct.has(item.id)) continue
    if (
      !equipmentSupportsBoatNetwork(
        item.productNetworkKeys,
        targetNetwork.networkKey,
      )
    ) {
      continue
    }
    const onNetworks = equipmentDirectNetworkIds(item.id, connections)
    let viaNetworkName: string | undefined
    let via: 'linked_network' | 'catalog' = 'catalog'
    for (const networkId of onNetworks) {
      if (networkId === targetNetwork.id) continue
      if (reachableNetworks.has(networkId)) {
        via = 'linked_network'
        viaNetworkName = networkName.get(networkId)
        break
      }
    }
    if (via === 'catalog' && onNetworks.size === 0) {
      // Catalog match with no current network link.
    } else if (via === 'catalog' && onNetworks.size > 0) {
      // On another network that is not linked to this backbone.
      continue
    }
    if (seen.has(item.id)) continue
    seen.add(item.id)
    possible.push({
      assetId: item.id,
      name: item.name,
      brand: item.brand,
      modelNumber: item.modelNumber,
      via,
      viaNetworkName,
    })
  }

  return possible.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
}

export function networkHasAnyActivity(
  networkId: string,
  connections: BoatNetworkGraphConnection[],
): boolean {
  for (const row of connections) {
    if (row.fromAssetId === networkId || row.toAssetId === networkId) {
      return true
    }
  }
  return false
}
