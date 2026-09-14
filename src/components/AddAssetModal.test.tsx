// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../lib/i18n'
import { AddAssetModal, findExistingBoatAsset } from './AddAssetModal'
import type { ListedBoatAsset } from './AddAssetModal'
import type { CatalogProduct } from '../domain/product-catalog'

const mocks = vi.hoisted(() => ({
  identify: vi.fn(),
  start: vi.fn(),
  poll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  camera: vi.fn(),
  native: vi.fn(),
  resolve: vi.fn(),
  brands: vi.fn(),
  models: vi.fn(),
  product: vi.fn(),
  connections: vi.fn(),
  openDocument: vi.fn(),
}))
vi.mock('../lib/boat-assets-api', () => ({
  createBoatAsset: mocks.create,
  identifyAssetPhoto: mocks.identify,
  startAssetResearchJob: mocks.start,
  fetchAssetResearchJob: mocks.poll,
  updateBoatAsset: mocks.update,
  uploadAndLinkAssetDocument: mocks.upload,
  findEquipmentConnections: mocks.connections,
}))
vi.mock('../lib/product-catalog-api', () => ({
  resolveEquipmentProduct: mocks.resolve,
  findCatalogBrands: mocks.brands,
  findCatalogProducts: mocks.models,
  fetchCatalogProduct: mocks.product,
}))
vi.mock('../lib/boat-document-open', () => ({
  openBoatDocument: mocks.openDocument,
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.native },
}))
vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: mocks.camera },
  CameraSource: { Prompt: 'PROMPT' },
  CameraResultType: { Uri: 'uri' },
}))

const photo = new File(['photo'], 'pump.jpg', { type: 'image/jpeg' })
const product: CatalogProduct = {
  id: 'product',
  brand: 'Garmin',
  modelNumber: '923',
  reviewStatus: 'candidate',
  language: 'en',
  requestedLanguage: 'en',
  researchStatus: 'preview',
  imageUrl: '/photo',
  resources: [],
  info: {
    name: 'Chartplotter',
    description: 'Marine display',
    category: 'Navigation',
    specifications: [],
    sources: [],
  },
}
const manual = {
  id: 'manual',
  title: 'Installation guide',
  sourceUrl: 'https://example.com/manual.pdf',
  purpose: 'manual',
  languages: ['en'],
  revision: null,
  modelNumbers: ['923'],
  reason: 'Official',
  reviewStatus: 'candidate',
  contentUrl: '/api/products/product/resources/manual/content',
}
const props = {
  boatId: 'boat',
  boatName: 'Boat',
  orgName: null,
  members: [],
  assets: [
    {
      id: 'gps',
      name: 'GPS receiver',
      description: null,
      modelNumber: 'GPS1',
      category: 'Navigation',
    },
    {
      id: 'radar',
      name: 'Radar',
      description: null,
      modelNumber: 'R1',
      category: 'Navigation',
    },
    {
      id: 'pump',
      name: 'Water pump',
      description: null,
      modelNumber: null,
      category: 'Plumbing',
    },
  ] satisfies ListedBoatAsset[],
  onClose: vi.fn(),
  onCreated: vi.fn(),
  onUpdated: vi.fn(),
  onOpenExisting: vi.fn(),
}
function mount(overrides: { assets?: ListedBoatAsset[] } = {}) {
  return render(
    <I18nProvider>
      <AddAssetModal {...props} {...overrides} />
    </I18nProvider>,
  )
}
function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}
function enter(label: string, value: string) {
  const input = screen.getByRole('combobox', { name: label })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}
async function find() {
  enter('Brand', 'Garmin')
  enter('Model', '923')
  click('Next')
  await screen.findByText('Is this your equipment?')
}
async function skipDocuments() {
  click('Next')
  await screen.findByText('Search for documents?')
  click('Skip')
  click('Next')
  await screen.findByText('Search for connections?')
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.native.mockReturnValue(false)
  URL.createObjectURL = vi.fn(() => 'blob:photo')
  URL.revokeObjectURL = vi.fn()
  mocks.brands.mockResolvedValue([
    { name: 'Garmin', logo: '/brands/garmin.svg' },
  ])
  mocks.models.mockResolvedValue({ products: [product], exact: true })
  mocks.resolve.mockResolvedValue({ product, pending: false, notice: '' })
  mocks.product.mockResolvedValue({ ...product, resources: [manual] })
  mocks.identify.mockResolvedValue({
    name: 'Garmin 923 Chartplotter',
    brand: 'Garmin',
    modelNumber: '923',
    description: 'My display',
    category: 'Navigation',
    confidence: 'high',
  })
  mocks.start.mockResolvedValue({ jobId: 'job' })
  mocks.poll.mockResolvedValue({ id: 'job', status: 'pending', error: null })
  mocks.connections.mockResolvedValue([
    { assetId: 'gps', reason: 'Position data' },
  ])
  mocks.create.mockResolvedValue({ id: 'created' })
  mocks.update.mockResolvedValue({ id: 'existing' })
  mocks.upload.mockResolvedValue(undefined)
  mocks.openDocument.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('uses the catalog automatically and settles brand/model into editable identity labels', async () => {
  mount()
  await find()
  expect(mocks.resolve).toHaveBeenCalledWith(
    'Garmin',
    '923',
    'en',
    expect.any(AbortSignal),
  )
  expect(screen.getByRole('img', { name: 'Garmin' })).toBeTruthy()
  expect(screen.getByText('923')).toBeTruthy()
  expect(mocks.start).not.toHaveBeenCalled()
  click('Back')
  expect(
    screen.getByRole('button', { name: 'Edit Model' }).textContent,
  ).toContain('923')
  expect(screen.queryByText(/Use the shared product catalog/)).toBeNull()
})
it('completes the skip path without any document or connection AI requests', async () => {
  mount()
  await find()
  await skipDocuments()
  click('Skip')
  click('Add equipment')
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      'boat',
      expect.objectContaining({
        productId: 'product',
        sharedProduct: true,
        researchDocuments: false,
        confirmedConnections: [],
        researchJobId: undefined,
      }),
      undefined,
    ),
  )
  expect(mocks.start).not.toHaveBeenCalled()
  expect(mocks.connections).not.toHaveBeenCalled()
  expect(props.onCreated).toHaveBeenCalled()
})
it('skips research prompts when documents already exist in the user language', async () => {
  mocks.resolve.mockResolvedValue({
    product: { ...product, resources: [manual] },
    pending: false,
    notice: '',
  })
  mount()
  await find()
  click('Next')
  expect(screen.queryByText('Search for documents?')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Installation guide/ }))
  expect(mocks.openDocument).toHaveBeenCalledWith(
    expect.objectContaining({ contentUrl: manual.contentUrl }),
    expect.anything(),
  )
  expect(mocks.start).not.toHaveBeenCalled()
})
it('keeps the photo attached and identifies it immediately', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('Asset photo'), {
    target: { files: [photo] },
  })
  await screen.findByRole('button', { name: 'Edit Model' })
  click('Next')
  await screen.findByText('Is this your equipment?')
  await skipDocuments()
  click('Skip')
  click('Add equipment')
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      'boat',
      expect.objectContaining({ modelNumber: '923' }),
      photo,
    ),
  )
})
it('opens the OS chooser for a camera or existing photo on native devices', async () => {
  mocks.native.mockReturnValue(true)
  mocks.camera.mockResolvedValue({ webPath: 'native-photo', format: 'jpeg' })
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({
        blob: async () => new Blob(['photo'], { type: 'image/jpeg' }),
      }),
  )
  mount()
  click('Take or choose a photo')
  await waitFor(() => expect(mocks.identify).toHaveBeenCalled())
  expect(mocks.camera).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'PROMPT', saveToGallery: false }),
  )
})
it('continues without a model after identification fails and retains the photo', async () => {
  mocks.identify.mockRejectedValue(new Error('Photo unavailable'))
  mount()
  fireEvent.change(screen.getByLabelText('Asset photo'), {
    target: { files: [photo] },
  })
  await screen.findByText('Photo unavailable')
  fireEvent.click(screen.getByLabelText('No model number'))
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Red pump under the sink' },
  })
  click('Next')
  await skipDocuments()
  click('Skip')
  click('Add equipment')
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      'boat',
      expect.objectContaining({
        name: 'Red pump under the sink',
        modelNumber: null,
      }),
      photo,
    ),
  )
  expect(mocks.resolve).not.toHaveBeenCalled()
})
it('lets document research continue in the background and links the job on save', async () => {
  mount()
  await find()
  click('Next')
  click('Okay')
  await screen.findByText('Search in progress')
  expect(mocks.start).toHaveBeenCalledWith(
    'boat',
    expect.objectContaining({
      includeConnections: false,
      language: 'en',
      sharedProduct: true,
    }),
  )
  click('Skip')
  click('Next')
  click('Skip')
  click('Add equipment')
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      'boat',
      expect.objectContaining({ researchJobId: 'job' }),
      undefined,
    ),
  )
})
it('advances to documents when research completes', async () => {
  mocks.poll.mockResolvedValue({
    id: 'job',
    status: 'completed',
    result: {
      productId: 'product',
      category: 'Navigation',
      downloads: [],
      connections: [],
    },
  })
  mount()
  await find()
  click('Next')
  click('Okay')
  await screen.findByText('Installation guide')
  expect(screen.queryByText('Search in progress')).toBeNull()
})
it('does not pull the user back from connections when background documents finish', async () => {
  let finish!: (value: unknown) => void
  mocks.poll.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  mount()
  await find()
  click('Next')
  click('Okay')
  await screen.findByText('Search in progress')
  click('Skip')
  click('Next')
  click('Skip')
  await act(async () =>
    finish({
      status: 'completed',
      result: {
        productId: 'product',
        downloads: [],
        connections: [],
        category: 'Navigation',
      },
    }),
  )
  expect(screen.getByText('Review connections')).toBeTruthy()
})
it('lets users uncheck AI connections and manually choose only same-category equipment', async () => {
  mocks.connections.mockResolvedValue([
    { assetId: 'gps', reason: 'Position data' },
    { assetId: 'pump', reason: 'Wrong category' },
  ])
  mount()
  await find()
  await skipDocuments()
  click('Okay')
  await screen.findByText('GPS receiver')
  expect(screen.queryByText('Water pump')).toBeNull()
  const checkbox = screen.getByRole<HTMLInputElement>('checkbox', {
    name: /GPS receiver/,
  })
  expect(checkbox.checked).toBe(true)
  fireEvent.click(checkbox)
  click('Add connection')
  expect(screen.queryByText('Water pump')).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: /Radar/ }))
  click('Add connection')
  click('Add equipment')
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      'boat',
      expect.objectContaining({
        confirmedConnections: [
          { assetId: 'radar', reason: 'Connection selected by the user.' },
        ],
      }),
      undefined,
    ),
  )
})
it('ignores a stale model lookup after going back and changing the model', async () => {
  let finish!: (value: unknown) => void
  mocks.resolve.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  mount()
  enter('Brand', 'Garmin')
  enter('Model', '923')
  click('Next')
  await screen.findByText('Finding your equipment…')
  click('Back')
  click('Edit Model')
  enter('Model', '943')
  await act(async () => finish({ product, pending: false, notice: '' }))
  expect(
    screen.getByRole('button', { name: 'Edit Model' }).textContent,
  ).toContain('943')
  expect(screen.queryByText('Is this your equipment?')).toBeNull()
})
it('keeps the form for retry on a catalog failure', async () => {
  mocks.resolve.mockRejectedValueOnce(new Error('Catalog unavailable'))
  mount()
  await find()
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Next' }).disabled,
  ).toBe(true)
  click('Try again')
  await screen.findByText('Chartplotter')
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Next' }).disabled,
  ).toBe(false)
})
it('keeps confirmed choices after a save failure and prevents duplicate submissions', async () => {
  mocks.create.mockRejectedValueOnce(new Error('Save unavailable'))
  mount()
  await find()
  await skipDocuments()
  click('Okay')
  await screen.findByText('GPS receiver')
  click('Add equipment')
  await screen.findByText('Save unavailable')
  expect(
    screen.getByRole<HTMLInputElement>('checkbox', { name: /GPS receiver/ })
      .checked,
  ).toBe(true)
  click('Add equipment')
  await waitFor(() => expect(props.onCreated).toHaveBeenCalled())
})
it('handles a duplicate by opening or merging existing equipment', async () => {
  mount({
    assets: [
      {
        id: 'existing',
        name: 'Old display',
        brand: 'Garmin',
        modelNumber: '923',
        category: 'Navigation',
        description: 'Existing note',
      },
    ],
  })
  await find()
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Next' }).disabled,
  ).toBe(true)
  click('Merge')
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith(
      'boat',
      'existing',
      expect.objectContaining({
        description: 'Existing note\n\nMarine display',
      }),
    ),
  )
  expect(props.onUpdated).toHaveBeenCalled()
})
it('selects brand suggestions with the keyboard without reverting on blur', async () => {
  mount()
  const brand = screen.getByRole('combobox', { name: 'Brand' })
  fireEvent.focus(brand)
  fireEvent.change(brand, { target: { value: 'Gar' } })
  await screen.findByRole('option', { name: 'Garmin' })
  fireEvent.keyDown(brand, { key: 'ArrowDown' })
  fireEvent.keyDown(brand, { key: 'Enter' })
  expect(screen.getByRole('img', { name: 'Garmin' })).toBeTruthy()
  enter('Model', '923')
  click('Next')
  await waitFor(() =>
    expect(mocks.resolve).toHaveBeenCalledWith(
      'Garmin',
      '923',
      'en',
      expect.anything(),
    ),
  )
})
it('requires confirmation to discard and never closes on backdrop taps', () => {
  mount()
  enter('Brand', 'Garmin')
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  fireEvent.click(screen.getByRole('dialog').parentElement!)
  expect(props.onClose).not.toHaveBeenCalled()
  click('Close')
  expect(props.onClose).not.toHaveBeenCalled()
})
it('matches legacy branded models without confusing manufacturers', () => {
  const existing = {
    id: 'receiver',
    name: 'Quark-Elec QK-A026-Plus Receiver',
    brand: null,
    modelNumber: 'Quark Elec QK-A026-Plus',
    description: null,
    category: null,
  }
  expect(
    findExistingBoatAsset([existing], {
      brand: 'Quark-Elec',
      name: 'Receiver',
      modelNumber: 'QK-A026-Plus',
    }),
  ).toBe(existing)
  expect(
    findExistingBoatAsset([existing], {
      brand: 'Custom Marine',
      name: 'Receiver',
      modelNumber: 'QK-A026-Plus',
    }),
  ).toBeNull()
})
