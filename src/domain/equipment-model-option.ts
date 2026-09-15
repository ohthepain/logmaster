import type { CatalogProduct } from './product-catalog'

export type EquipmentModelOption = {
  brand: string
  modelNumber: string
  name: string
  description: string
  imageUrl: string | null
  productPageUrl: string | null
  specifications: Array<{
    name: string
    value: string
    unit: string | null
  }>
}

export type EquipmentModelSuggestResult = {
  brandCorrect: boolean
  brandGuesses: string[]
  ambiguous: boolean
  options: EquipmentModelOption[]
  products: CatalogProduct[]
}
