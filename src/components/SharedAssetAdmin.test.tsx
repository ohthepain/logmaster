// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SharedAssetAdmin } from './SharedAssetAdmin'
import { SharedAssetPanel } from './SharedAssetPanel'
import type { ProductAdminDetail } from '../domain/product-admin'

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  detail: vi.fn(),
  save: vi.fn(),
  regenerate: vi.fn(),
}))
vi.mock('../lib/product-catalog-api', () => ({
  searchSharedProducts: mocks.search,
  fetchAdminProduct: mocks.detail,
  saveAdminProduct: mocks.save,
  regenerateAdminProduct: mocks.regenerate,
}))
vi.mock('./DevComponentLabel', () => ({ DevComponentLabel: () => null }))

const product: ProductAdminDetail = {
  id: 'pump',
  brand: 'Test Marine',
  modelNumber: 'P100',
  reviewStatus: 'candidate',
  canonicalImageId: null,
  aliases: ['Pressure 100'],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-13T00:00:00.000Z',
  reviewedAt: null,
  reviewedBy: null,
  networkConnections: [],
  locales: [
    {
      language: 'en',
      status: 'completed',
      error: null,
      researchedAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      info: {
        name: 'Water pump',
        description: 'Original description',
        category: 'Plumbing',
        specifications: [{ name: 'Flow', value: '10', unit: 'L/min' }],
        sources: [{ title: 'Manufacturer', url: 'https://example.com/pump' }],
      },
      researchDocuments: [],
    },
    {
      language: 'sv',
      status: 'completed',
      error: null,
      researchedAt: null,
      updatedAt: '2026-09-01T00:00:00.000Z',
      info: {
        name: 'Vattenpump',
        description: 'Svensk beskrivning',
        category: 'Plumbing',
        specifications: [],
        sources: [],
      },
      researchDocuments: [],
    },
  ],
  resources: [
    {
      id: 'manual',
      title: 'Instructions',
      sourceUrl: 'https://example.com/manual.pdf',
      purpose: 'manual',
      languages: ['en'],
      revision: '2',
      modelNumbers: ['P100'],
      reason: 'Installation',
      reviewStatus: 'candidate',
      contentUrl: '/api/products/pump/resources/manual/content',
      mimeType: 'application/pdf',
      cached: true,
      imageUrl: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.search.mockResolvedValue({
    products: [
      {
        id: product.id,
        brand: product.brand,
        modelNumber: product.modelNumber,
        reviewStatus: product.reviewStatus,
        name: 'Water pump',
        languages: ['en', 'sv'],
        resourceCount: 1,
        updatedAt: product.updatedAt,
      },
    ],
    total: 60,
    page: 1,
    pageSize: 25,
  })
  mocks.detail.mockResolvedValue(structuredClone(product))
  mocks.save.mockResolvedValue({
    ...structuredClone(product),
    updatedAt: '2026-09-13T01:00:00.000Z',
  })
})
afterEach(cleanup)

it('searches all products, paginates, and opens the tapped result in a detail panel', async () => {
  render(<SharedAssetAdmin />)
  await screen.findByText('60 products found')
  fireEvent.change(screen.getByLabelText('Search shared assets'), {
    target: { value: 'pressure pump' },
  })
  await waitFor(() =>
    expect(mocks.search).toHaveBeenLastCalledWith(
      'pressure pump',
      'all',
      1,
      expect.any(AbortSignal),
    ),
  )
  await screen.findByText('60 products found')
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() =>
    expect(mocks.search).toHaveBeenLastCalledWith(
      'pressure pump',
      'all',
      2,
      expect.any(AbortSignal),
    ),
  )
  await screen.findByText('60 products found')
  fireEvent.click(screen.getByRole('button', { name: /Test Marine P100/ }))
  await screen.findByRole('dialog')
  await screen.findByLabelText('Product name')
  expect(mocks.detail).toHaveBeenCalledWith('pump', expect.any(AbortSignal))
  expect(
    screen.getByLabelText<HTMLTextAreaElement>('Model aliases (one per line)')
      .value,
  ).toBe('Pressure 100')
  expect(screen.getByLabelText<HTMLInputElement>('Value 1').value).toBe('10')
  expect(screen.getByText('Shared documents and photos (1)')).toBeTruthy()
})
it('edits all localized facts and saves a versioned payload without private asset data', async () => {
  const onSaved = vi.fn()
  render(
    <SharedAssetPanel productId="pump" onClose={vi.fn()} onSaved={onSaved} />,
  )
  await screen.findByLabelText('Description')
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Corrected description' },
  })
  fireEvent.change(screen.getByLabelText('Value 1'), {
    target: { value: '12' },
  })
  fireEvent.change(screen.getByLabelText('Content language'), {
    target: { value: 'sv' },
  })
  expect(screen.getByLabelText<HTMLInputElement>('Product name').value).toBe(
    'Vattenpump',
  )
  fireEvent.change(screen.getByLabelText('Product name'), {
    target: { value: 'Tryckpump' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(mocks.save).toHaveBeenCalled())
  const saved = mocks.save.mock.calls[0][1]
  expect(saved.updatedAt).toBe(product.updatedAt)
  expect(saved.locales[0].info.description).toBe('Corrected description')
  expect(saved.locales[0].info.specifications[0].value).toBe('12')
  expect(saved.locales[1].info.name).toBe('Tryckpump')
  expect(saved.resources[0].revision).toBe('2')
  expect(saved).not.toHaveProperty('assets')
  await screen.findByText('Shared asset information saved.')
  expect(onSaved).toHaveBeenCalledOnce()
})
it('keeps unsaved edits visible when saving fails', async () => {
  mocks.save.mockRejectedValue(
    new Error('This product changed. Reopen it before saving.'),
  )
  render(
    <SharedAssetPanel productId="pump" onClose={vi.fn()} onSaved={vi.fn()} />,
  )
  await screen.findByLabelText('Description')
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Keep this edit' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText<HTMLTextAreaElement>('Description').value).toBe(
    'Keep this edit',
  )
})
it('ignores stale searches and resets pagination when filters change', async () => {
  let finish!: (value: unknown) => void
  mocks.search.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  render(<SharedAssetAdmin />)
  await waitFor(() => expect(mocks.search).toHaveBeenCalledOnce())
  fireEvent.change(screen.getByLabelText('Review status'), {
    target: { value: 'rejected' },
  })
  await screen.findByText('60 products found')
  finish({ products: [], total: 999, page: 1, pageSize: 25 })
  await waitFor(() =>
    expect(mocks.search).toHaveBeenLastCalledWith(
      '',
      'rejected',
      1,
      expect.any(AbortSignal),
    ),
  )
  expect(screen.queryByText('999 products found')).toBeNull()
})
it('regenerates AI information including boat network connections', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  mocks.regenerate.mockResolvedValue({
    ...structuredClone(product),
    networkConnections: [{ networkKey: 'seatal_kng', portCount: 2 }],
    locales: product.locales.map((locale) =>
      locale.language === 'en'
        ? {
            ...locale,
            info: {
              ...locale.info!,
              description: 'Regenerated description',
            },
          }
        : locale,
    ),
  })
  render(
    <SharedAssetPanel productId="pump" onClose={vi.fn()} onSaved={vi.fn()} />,
  )
  await screen.findByLabelText('Description')
  fireEvent.click(
    screen.getByRole('button', { name: 'Regenerate AI information' }),
  )
  expect(confirm).toHaveBeenCalled()
  await waitFor(() =>
    expect(mocks.regenerate).toHaveBeenCalledWith('pump', 'en'),
  )
  await screen.findByText(
    'AI information regenerated, including boat network connections.',
  )
  expect(screen.getByLabelText<HTMLTextAreaElement>('Description').value).toBe(
    'Regenerated description',
  )
  expect(
    (screen.getByRole('checkbox', { name: 'SeaTalkNG' }) as HTMLInputElement)
      .checked,
  ).toBe(true)
  expect(screen.getByLabelText<HTMLInputElement>('Ports').value).toBe('2')
  confirm.mockRestore()
})
it('does not regenerate AI information when the prompt is cancelled', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(
    <SharedAssetPanel productId="pump" onClose={vi.fn()} onSaved={vi.fn()} />,
  )
  await screen.findByLabelText('Description')
  fireEvent.click(screen.getByRole('button', { name: /^Regenerate AI$/ }))
  expect(mocks.regenerate).not.toHaveBeenCalled()
})

it('deletes a saved document from the shared catalog on save', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(
    <SharedAssetPanel productId="pump" onClose={vi.fn()} onSaved={vi.fn()} />,
  )
  await screen.findByText('Shared documents and photos (1)')
  fireEvent.click(screen.getByRole('button', { name: 'Delete document' }))
  expect(confirm).toHaveBeenCalled()
  await screen.findByText('Shared documents and photos (0)')
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(mocks.save).toHaveBeenCalled())
  expect(mocks.save.mock.calls[0][1].resources).toEqual([])
  confirm.mockRestore()
})
