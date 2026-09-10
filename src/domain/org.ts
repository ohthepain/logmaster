import type { BoatDocumentKind } from './boat'
import type { DocumentPurpose } from './boat-assets'
import type { ContactResourceArea } from './contact'

export type OrgMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

export type OrgPhoto = {
  id: string
  orgId: string
  mimeType: string
  caption: string | null
  isDefault: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  imageUrl: string
}

export type OrgDocumentVersion = {
  id: string
  documentId: string
  versionNumber: number
  kind: BoatDocumentKind
  mimeType: string | null
  url: string | null
  fileName: string | null
  createdAt: string
  contentUrl: string | null
}

export type OrgDocumentCategory = {
  id: string
  orgId: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type OrgDocument = {
  id: string
  orgId: string
  categoryId: string
  title: string
  purpose: DocumentPurpose | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  currentVersion: OrgDocumentVersion
}

export type OrgDocumentsPayload = {
  categories: OrgDocumentCategory[]
  documents: OrgDocument[]
}

export type OrgContact = {
  id: string
  orgId: string
  userId: string | null
  displayName: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  notes: string | null
  grants: ContactResourceArea[]
  createdAt: string
  updatedAt: string
}

export type OrgMember = {
  id: string
  orgId: string
  userId: string
  contactId: string | null
  role: OrgMemberRole
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

export type OrgMemberOwnedShare = {
  id: string
  sequence: number
  label: string | null
  displayName: string
}

export type OrgMemberBoat = {
  id: string
  name: string
  iconId: string
  shareCount: number
  isBoatOwner: boolean
  boatMemberRole: OrgMemberRole | null
  ownedShares: OrgMemberOwnedShare[]
}

export type OrgContactDetail = {
  contact: OrgContact
  member: OrgMember | null
  boats: OrgMemberBoat[]
  canEditContact: boolean
  canManageMembership: boolean
  canManageGrants: boolean
}

export type Org = {
  id: string
  name: string
  createdByUserId: string
  visibility: string
  shareToken: string | null
  createdAt: string
  updatedAt: string
  boats?: Array<{ id: string; name: string }>
  memberCount?: number
  photos: OrgPhoto[]
  defaultPhoto: OrgPhoto | null
}

export function defaultOrgPhoto(photos: OrgPhoto[]): OrgPhoto | null {
  if (photos.length === 0) return null
  return photos.find((photo) => photo.isDefault) ?? photos[0]
}
