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
  createdAt: string
  updatedAt: string
  photos: BoatPhoto[]
}

export type BoatSummary = Pick<Boat, 'id' | 'name' | 'createdAt' | 'updatedAt'> & {
  photos: BoatPhoto[]
  defaultPhoto: BoatPhoto | null
}
