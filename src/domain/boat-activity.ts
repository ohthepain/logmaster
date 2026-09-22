export const boatActivityKinds = [
  'MEDIA_ADDED',
  'MEDIA_UPDATED',
  'MEDIA_REMOVED',
  'DOCUMENT_ADDED',
  'DOCUMENT_UPDATED',
  'DOCUMENT_REMOVED',
  'ASSET_ADDED',
  'ASSET_UPDATED',
  'ASSET_REMOVED',
  'ASSET_CONNECTED',
  'ASSET_DISCONNECTED',
  'NETWORK_CONNECTED',
  'NETWORK_DISCONNECTED',
  'PURCHASE_ADDED',
  'PURCHASE_REMOVED',
  'CONTACT_ADDED',
  'CONTACT_UPDATED',
  'CONTACT_REMOVED',
  'MEMBER_ADDED',
  'MEMBER_UPDATED',
  'MEMBER_REMOVED',
  'SHARE_ADDED',
  'SHARE_UPDATED',
  'SHARE_REMOVED',
] as const
export type BoatActivityKind = (typeof boatActivityKinds)[number]
export type BoatChatActivity = {
  id: string
  kind: BoatActivityKind
  label: string
  targetLabel: string | null
  preview: null | {
    kind: 'image' | 'video' | 'audio' | 'pdf' | 'file' | 'link'
    url: string
    title: string
  }
}
