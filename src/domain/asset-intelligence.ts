export const ASSET_CATEGORIES = [
  'Propulsion',
  'Electrical',
  'Navigation',
  'Communications',
  'Instruments',
  'Safety',
  'Plumbing',
  'Hull, deck & rigging',
  'Comfort',
  'Galley',
  'Recreation',
] as const

export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export type AssetIdentification = {
  name: string
  description: string
  brand: string | null
  modelNumber: string | null
  confidence: 'high' | 'medium' | 'low'
  category: AssetCategory | null
  photoUrl?: string | null
}

export type AssetConnectionSuggestion = {
  assetId: string
  reason: string
  connectionType?: 'cable' | 'wifi' | 'bluetooth' | 'nmea0183'
  name?: string
  kind?: 'equipment' | 'network'
}

export type AssetDownloadSuggestion = {
  id: string
  title: string
  url: string
  purpose: 'manual' | 'photo' | 'warranty' | 'other'
  reason: string
  documentId: string | null
}

export type { AssetConnectionDetail as AssetConnection } from './asset-connections'

export type AssetResearch = {
  productId?: string
  category: AssetCategory | null
  downloads: Omit<AssetDownloadSuggestion, 'id' | 'documentId'>[]
  connections: AssetConnectionSuggestion[]
}
