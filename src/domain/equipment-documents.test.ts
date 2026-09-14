import { expect, it } from 'vitest'
import { equipmentDocuments, hasLocalizedDocuments } from './product-catalog'
import type { CatalogProduct, ProductResource } from './product-catalog'

function product(resources: Array<Partial<ProductResource>>) {
  return {
    resources: resources.map((r, i) => ({
      id: String(i),
      purpose: 'manual',
      ...r,
    })),
  } as CatalogProduct
}
it('uses the user language first including regional and multilingual documents', () => {
  const p = product([
    { languages: ['sv'] },
    { languages: ['en'] },
    { languages: ['sv', 'en'] },
    { languages: ['de'] },
  ])
  expect(hasLocalizedDocuments(p, 'sv-SE')).toBe(true)
  expect(equipmentDocuments(p, 'sv-SE').map((r) => r.id)).toEqual(['0', '2'])
})
it('offers research when only English fallback documents exist', () => {
  const p = product([
    { languages: ['en'] },
    { languages: ['de'] },
    { languages: [] },
    { purpose: 'photo', languages: ['sv'] },
  ])
  expect(hasLocalizedDocuments(p, 'sv')).toBe(false)
  expect(equipmentDocuments(p, 'sv').map((r) => r.id)).toEqual(['0'])
})
it('does not claim photos or unknown-language files satisfy a document search', () => {
  const p = product([
    { purpose: 'photo', languages: ['en'] },
    { languages: [] },
  ])
  expect(hasLocalizedDocuments(p, 'en')).toBe(false)
  expect(equipmentDocuments(p, 'en')).toEqual([])
})
it('includes regional English documents as fallbacks', () => {
  expect(
    equipmentDocuments(product([{ languages: ['en-US'] }]), 'sv'),
  ).toHaveLength(1)
})
