import type { BoatDocumentVersion } from './boat'
import type { ExpenseClaim, OrgTransaction } from './org-accounting'
import type {
  AssetCategory,
  AssetConnection,
  AssetDownloadSuggestion,
} from './asset-intelligence'

export type AssetOwnership = 'BOAT' | 'ORG' | 'USER' | 'EXTERNAL'

export type AssetWorkType = 'install' | 'service' | 'repair' | 'other'

export type DocumentPurpose =
  | 'receipt'
  | 'invoice'
  | 'photo'
  | 'manual'
  | 'warranty'
  | 'other'

export type BoatAssetUserRef = {
  id: string
  name: string
  email: string
}

export type LinkedBoatDocumentRef = {
  id: string
  title: string
  purpose: DocumentPurpose | null
}

export type LinkedBoatDocumentDetail = LinkedBoatDocumentRef & {
  currentVersion: BoatDocumentVersion
}

export type BoatAssetDetail = Omit<
  BoatAsset,
  'documents' | 'workRecordCount'
> & {
  documents: LinkedBoatDocumentDetail[]
  workRecords: AssetWork[]
}

export type BoatAsset = {
  id: string
  boatId: string
  name: string
  description: string | null
  modelNumber: string | null
  category: AssetCategory | null
  suggestedDownloads: AssetDownloadSuggestion[]
  connections: AssetConnection[]
  ownership: AssetOwnership
  ownedByUserId: string | null
  onLoanFromUserId: string | null
  ownerLabel: string
  installedAt: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  ownedByUser: BoatAssetUserRef | null
  onLoanFromUser: BoatAssetUserRef | null
  documents: LinkedBoatDocumentDetail[]
  purchaseLineIds: string[]
  workRecordCount: number
}

export type BoatPurchaseLine = {
  id: string
  purchaseId: string
  description: string
  quantity: string | null
  unitPrice: string | null
  amount: string
  assetId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  asset: { id: string; name: string } | null
}

export type BoatPurchase = {
  id: string
  boatId: string
  orgId: string | null
  supplierName: string | null
  purchasedAt: string | null
  notes: string | null
  totalAmount: string | null
  currency: string
  createdAt: string
  updatedAt: string
  lines: BoatPurchaseLine[]
  documents: LinkedBoatDocumentRef[]
}

export type AssetWork = {
  id: string
  assetId: string
  boatId: string
  type: AssetWorkType
  performedAt: string | null
  description: string | null
  costAmount: string | null
  costCurrency: string | null
  createdAt: string
  updatedAt: string
  documents: LinkedBoatDocumentRef[]
  asset: { id: string; name: string }
}

export type BoatAccountingSummary = {
  orgId: string | null
  bankAccounts: Array<{
    id: string
    name: string
    currency: string
    openingBalance: string
    currentBalance: string
  }>
  purchases: BoatPurchase[]
  expenseClaims: ExpenseClaim[]
  transactions: OrgTransaction[]
  workCosts: Array<{
    id: string
    assetId: string
    assetName: string
    type: AssetWorkType
    performedAt: string | null
    description: string | null
    costAmount: string | null
    costCurrency: string | null
  }>
}

export const ASSET_OWNERSHIP_LABELS: Record<AssetOwnership, string> = {
  BOAT: 'Boat',
  ORG: 'Org',
  USER: 'User',
  EXTERNAL: 'External',
}

export const DOCUMENT_PURPOSE_LABELS: Record<DocumentPurpose, string> = {
  receipt: 'Receipt',
  invoice: 'Invoice',
  photo: 'Photo',
  manual: 'Manual',
  warranty: 'Warranty',
  other: 'Other',
}

export const ASSET_WORK_TYPE_LABELS: Record<AssetWorkType, string> = {
  install: 'Installation',
  service: 'Service',
  repair: 'Repair',
  other: 'Other',
}
