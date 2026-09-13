import { expect, it } from 'vitest'
import {
  languageRank,
  productIdentity,
  productModelKey,
} from './product-catalog'

it('matches formatting and known brand aliases without collapsing product variants', () => {
  expect(productIdentity('Quark Elec', 'Quark-Elec QK-A026+')).toMatchObject({
    brandKey: 'quark-elec',
    modelKey: productIdentity('Quark-Elec', 'QK A026+').modelKey,
  })
  for (const other of [
    'QK-A026',
    'QK-A026-Plus',
    'QK-A026+/12V',
    'QK-A026+.2',
  ]) {
    expect(productModelKey(other)).not.toBe(productModelKey('QK-A026+'))
  }
})
it('prefers localized manuals and multilingual manuals before English fallbacks', () => {
  const resources = [['en'], [], ['sv', 'en'], ['sv'], ['de']]
  expect(
    resources
      .sort((a, b) => languageRank(a, 'sv') - languageRank(b, 'sv'))
      .slice(0, 3),
  ).toEqual([['sv'], ['sv', 'en'], ['en']])
  expect(languageRank(['pt-br'], 'pt-BR')).toBe(0)
  expect(languageRank(['pt'], 'pt-br')).toBe(2)
})
