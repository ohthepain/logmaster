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
  modelNumber: string | null
  confidence: 'high' | 'medium' | 'low'
  category: AssetCategory | null
}

export type AssetConnectionSuggestion = {
  assetId: string
  reason: string
}

export type AssetDownloadSuggestion = {
  id: string
  title: string
  url: string
  purpose: 'manual' | 'photo' | 'warranty' | 'other'
  reason: string
  documentId: string | null
}

export type AssetConnection = {
  id: string
  assetId: string
  name: string
  reason: string
}

export type AssetResearch = {
  category: AssetCategory | null
  downloads: Omit<AssetDownloadSuggestion, 'id' | 'documentId'>[]
  connections: AssetConnectionSuggestion[]
}
