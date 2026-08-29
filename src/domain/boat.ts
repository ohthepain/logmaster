import type { BoatIconId } from '../lib/boat-icons'

export type BoatPhoto = {
  id: string
  boatId: string
  s3Key: string
  mimeType: string
  caption: string | null
  isDefault: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  imageUrl: string
}

export type Boat = {
  id: string
  userId: string
  name: string
  iconId: BoatIconId
  createdAt: string
  updatedAt: string
  photos: BoatPhoto[]
}

export type BoatSummary = Pick<
  Boat,
  'id' | 'name' | 'iconId' | 'createdAt' | 'updatedAt'
> & {
  photos: BoatPhoto[]
  defaultPhoto: BoatPhoto | null
}

export function defaultBoatPhoto(photos: BoatPhoto[]): BoatPhoto | null {
  if (photos.length === 0) return null
  return photos.find((p) => p.isDefault) ?? photos[0]
}
