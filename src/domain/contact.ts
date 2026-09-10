import type { OrgMember, OrgMemberBoat } from './org'

export type ContactResourceArea =
  | 'PHOTOS'
  | 'DOCUMENTS'
  | 'ASSETS'
  | 'ACCOUNTING'

export const BOAT_CONTACT_AREAS: ContactResourceArea[] = [
  'PHOTOS',
  'DOCUMENTS',
  'ASSETS',
  'ACCOUNTING',
]

export const ORG_CONTACT_AREAS: ContactResourceArea[] = [
  'DOCUMENTS',
  'ACCOUNTING',
]

export const CONTACT_AREA_LABELS: Record<ContactResourceArea, string> = {
  PHOTOS: 'Photos',
  DOCUMENTS: 'Documents',
  ASSETS: 'Assets',
  ACCOUNTING: 'Accounting',
}

export type ResourceContact = {
  id: string
  displayName: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  notes: string | null
  grants: ContactResourceArea[]
  userId: string | null
  createdAt: string
  updatedAt: string
}

export type BoatContact = ResourceContact & {
  boatId: string
}

export type OrgContact = ResourceContact & {
  orgId: string
}

export type BoatContactGroup = {
  boatId: string
  boatName: string
  contacts: BoatContact[]
}

export type OrgContactsPayload = {
  orgContacts: OrgContact[]
  boatContacts: BoatContactGroup[]
}

export type BoatContactDetail = {
  contact: BoatContact
  canEditContact: boolean
  canManageGrants: boolean
}

export type OrgContactDetail = {
  contact: OrgContact
  member: OrgMember | null
  boats: OrgMemberBoat[]
  canEditContact: boolean
  canManageMembership: boolean
  canManageGrants: boolean
}

export function isContactResourceArea(
  value: string,
): value is ContactResourceArea {
  return (
    value === 'PHOTOS' ||
    value === 'DOCUMENTS' ||
    value === 'ASSETS' ||
    value === 'ACCOUNTING'
  )
}

export function formatContactGrants(grants: ContactResourceArea[]): string {
  if (grants.length === 0) return 'Address book only'
  return grants.map((grant) => CONTACT_AREA_LABELS[grant]).join(', ')
}
