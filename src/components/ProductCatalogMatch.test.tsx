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
      selectedId={null}
      onSelect={select}
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
      selectedId={null}
      onSelect={vi.fn()}
    />,
  )
  await screen.findByText('923')
  rerender(
    <ProductCatalogMatch
      brand=""
      model=""
      language="en"
      selectedId={null}
      onSelect={vi.fn()}
    />,
  )
  await waitFor(() => expect(screen.queryByText('923')).toBeNull())
})
