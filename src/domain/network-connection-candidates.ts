import type { BoatNetworkKey } from './asset-connections'

export type NetworkConnectionCandidateEquipment = {
  id: string
  name: string
  brand: string | null
  modelNumber: string | null
  /** Boat network assets this equipment is already linked to. */
  networkIds: string[]
}

export type NetworkConnectionCandidateNetwork = {
  id: string
  name: string
  networkKey: BoatNetworkKey
}

export type NetworkConnectionCandidates = {
  /** Other boat networks that share no equipment with this network yet. */
  otherNetworks: NetworkConnectionCandidateNetwork[]
  /** Equipment that can join this network and is not connected to it yet. */
  equipment: NetworkConnectionCandidateEquipment[]
}

export function networksShareEquipment(
  leftEquipmentIds: Set<string>,
  rightEquipmentIds: Set<string>,
): boolean {
  for (const id of leftEquipmentIds) {
    if (rightEquipmentIds.has(id)) return true
  }
  return false
}

export function equipmentSupportsBoatNetwork(
  productNetworkKeys: Set<BoatNetworkKey> | null,
  target: BoatNetworkKey,
): boolean {
  return !!productNetworkKeys?.has(target)
}

export function buildNetworkConnectionCandidates(input: {
  targetNetworkId: string
  targetNetworkKey: BoatNetworkKey
  connectedToTarget: Set<string>
  allNetworks: Array<{
    id: string
    name: string
    networkKey: BoatNetworkKey
    equipmentIds: Set<string>
  }>
  equipment: Array<{
    id: string
    name: string
    brand: string | null
    modelNumber: string | null
    productNetworkKeys: Set<BoatNetworkKey> | null
    networkIds: Set<string>
  }>
}): NetworkConnectionCandidates {
  const target = input.allNetworks.find((n) => n.id === input.targetNetworkId)
  const targetEquipment = target?.equipmentIds ?? new Set<string>()

  const otherNetworks = input.allNetworks
    .filter((network) => network.id !== input.targetNetworkId)
    .filter(
      (network) =>
        !networksShareEquipment(targetEquipment, network.equipmentIds),
    )
    .map(({ id, name, networkKey }) => ({ id, name, networkKey }))

  const equipment = input.equipment
    .filter((item) => !input.connectedToTarget.has(item.id))
    .filter((item) =>
      equipmentSupportsBoatNetwork(
        item.productNetworkKeys,
        input.targetNetworkKey,
      ),
    )
    .map(({ id, name, brand, modelNumber, networkIds }) => ({
      id,
      name,
      brand,
      modelNumber,
      networkIds: [...networkIds],
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )

  return { otherNetworks, equipment }
}
