import type { AssetConnectionType, BoatNetworkKey } from './asset-connections'

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
  devices: BoatNetworkDiagramDevice[]
}
