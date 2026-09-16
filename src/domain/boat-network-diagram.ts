import type { AssetConnectionType, BoatNetworkKey } from './asset-connections'
import type {
  BoatNetworkDiagramLink,
  BoatNetworkPossibleDevice,
} from './boat-network-graph'

export type BoatNetworkDiagramDevice = {
  assetId: string
  name: string
  brand: string | null
  modelNumber: string | null
  productImageUrl: string | null
  connectionId: string
  connectionType: AssetConnectionType
}

export type BoatNetworkDiagram = {
  networkAssetId: string
  networkKey: BoatNetworkKey
  name: string
  /** Equipment with a direct connection to this network backbone. */
  devices: BoatNetworkDiagramDevice[]
  /** Other boat networks linked directly to this backbone. */
  linkedNetworks: BoatNetworkDiagramLink[]
  /** Equipment that could join this network but is not directly connected yet. */
  possibleDevices: BoatNetworkPossibleDevice[]
}
