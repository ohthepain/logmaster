// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ProductCatalogMatch } from './ProductCatalogMatch'
import { productUiCopy } from '../lib/product-ui-copy'

const lookup = vi.hoisted(() => vi.fn())
vi.mock('../lib/product-catalog-api', () => ({ findCatalogProducts: lookup }))
vi.mock('../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: keyof typeof productUiCopy) => productUiCopy[key],
  }),
}))
afterEach(cleanup)
it('requires an explicit selection and shows exact model and review status', async () => {
  lookup.mockResolvedValue({
    products: [
      {
        id: 'p',
        brand: 'Quark-Elec',
        modelNumber: 'QK-A026+',
        reviewStatus: 'candidate',
        info: { name: 'AIS receiver' },
        imageUrl: null,
      },
    ],
  })
  const select = vi.fn()
  render(
    <ProductCatalogMatch
      brand="Quark Elec"
      model="QK-A026+"
      language="sv"
      selectedModelKey={null}
      onSelectCatalog={select}
    />,
  )
  await screen.findByText('QK-A026+')
  expect(select).not.toHaveBeenCalled()
  expect(lookup).toHaveBeenCalledWith(
    'Quark Elec',
    'QK-A026+',
    'sv',
    expect.any(AbortSignal),
  )
  fireEvent.click(screen.getByRole('button'))
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'p' }))
})
it('shows a product photo on suggested models', () => {
  const select = vi.fn()
  render(
    <ProductCatalogMatch
      brand="Raymarine"
      model="smart shunt"
      language="en"
      selectedModelKey={null}
      catalogProducts={[]}
      suggestedOptions={[
        {
          brand: 'Victron Energy',
          modelNumber: 'SHU050130050',
          name: 'SmartShunt 300A IP65',
          description: 'Battery monitor',
          imageUrl: 'https://example.com/shunt.png',
          productPageUrl: 'https://example.com/shunt',
          specifications: [{ name: 'Current', value: '300', unit: 'A' }],
        },
      ]}
      onSelectCatalog={vi.fn()}
      onSelectSuggested={select}
    />,
  )
  expect(document.querySelector('img[src="https://example.com/shunt.png"]')).toBeTruthy()
  fireEvent.click(screen.getByText('SHU050130050'))
  expect(select).toHaveBeenCalledWith(
    expect.objectContaining({ modelNumber: 'SHU050130050', brand: 'Victron Energy' }),
  )
})
it('clears stale matches when model identity changes', async () => {
  lookup.mockResolvedValue({
    products: [
      {
        id: 'p',
        brand: 'Garmin',
        modelNumber: '923',
        reviewStatus: 'verified',
        info: null,
        imageUrl: null,
      },
    ],
  })
  const { rerender } = render(
    <ProductCatalogMatch
      brand="Garmin"
      model="923"
      language="en"
      selectedModelKey={null}
      onSelectCatalog={vi.fn()}
    />,
  )
  await screen.findByText('923')
  rerender(
    <ProductCatalogMatch
      brand=""
      model=""
      language="en"
      selectedModelKey={null}
      onSelectCatalog={vi.fn()}
    />,
  )
  await waitFor(() => expect(screen.queryByText('923')).toBeNull())
})
