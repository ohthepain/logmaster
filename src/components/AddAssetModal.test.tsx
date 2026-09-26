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
  identifyLink: vi.fn(),
  start: vi.fn(),
  poll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  camera: vi.fn(),
  native: vi.fn(),
  platform: vi.fn(() => 'web'),
  resolve: vi.fn(),
  brands: vi.fn(),
  catalogModels: vi.fn(),
  models: vi.fn(),
  product: vi.fn(),
  modelOptions: vi.fn(),
  connections: vi.fn(),
  peers: vi.fn(),
  openDocument: vi.fn(),
}))
vi.mock('../lib/boat-assets-api', () => ({
  createBoatAsset: mocks.create,
  identifyAssetPhoto: mocks.identify,
  identifyEquipmentLink: mocks.identifyLink,
  startAssetResearchJob: mocks.start,
  fetchAssetResearchJob: mocks.poll,
  updateBoatAsset: mocks.update,
  uploadAndLinkAssetDocument: mocks.upload,
  findEquipmentConnections: mocks.connections,
  fetchConnectionPeers: mocks.peers,
}))
vi.mock('../lib/product-catalog-api', () => ({
  resolveEquipmentProduct: mocks.resolve,
  findCatalogBrands: mocks.brands,
  findCatalogModels: mocks.catalogModels,
  findCatalogProducts: mocks.models,
  fetchEquipmentModelOptions: mocks.modelOptions,
  fetchCatalogProduct: mocks.product,
}))
vi.mock('../lib/boat-document-open', () => ({
  openBoatDocument: mocks.openDocument,
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: mocks.native,
    getPlatform: mocks.platform,
  },
  registerPlugin: () => ({}),
}))
vi.mock('../lib/native/logmaster-recent-photos', () => ({
  supportsRecentPhotoPickerSheet: () => false,
  listRecentPhotoThumbnails: vi.fn(),
  loadRecentPhotoFile: vi.fn(),
}))
vi.mock('@capacitor/camera', () => ({
  Camera: { chooseFromGallery: mocks.camera },
  CameraErrorCode: { ChooseMediaCancelled: 'OS-PLUG-CAMR-0020' },
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
  networkConnections: [],
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
function clickFindMode(name: string | RegExp) {
  fireEvent.click(screen.getByRole('tab', { name }))
}
function enter(label: string, value: string) {
  const input = screen.getByRole('combobox', { name: label })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}
async function find() {
  clickFindMode('Model')
  enter('Brand', 'Garmin')
  enter('Model', '923')
  click('Search')
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
  mocks.catalogModels.mockResolvedValue([])
  mocks.models.mockResolvedValue({
    products: [product],
    exact: true,
    ambiguous: false,
  })
  mocks.modelOptions.mockResolvedValue({ options: [] })
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
  mocks.peers.mockResolvedValue({
    equipment: [
      {
        id: 'gps',
        name: 'GPS receiver',
        brand: null,
        modelNumber: 'GPS1',
      },
      {
        id: 'radar',
        name: 'Radar',
        brand: null,
        modelNumber: 'R1',
      },
      {
        id: 'pump',
        name: 'Water pump',
        brand: null,
        modelNumber: null,
      },
    ],
    networks: [
      {
        id: 'net_boat_seatal_kng',
        name: 'SeaTalkNG',
        networkKey: 'seatal_kng',
      },
    ],
  })
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
    { productId: 'product' },
  )
  expect(mocks.models).toHaveBeenCalledWith(
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
it('keeps the photo attached and identifies when the user searches', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('Asset photo'), {
    target: { files: [photo] },
  })
  expect(mocks.identify).not.toHaveBeenCalled()
  click('Search')
  await screen.findByText('Is this your equipment?')
  expect(mocks.identify).toHaveBeenCalled()
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
  mocks.platform.mockReturnValue('android')
  mocks.camera.mockResolvedValue({
    results: [
      {
        webPath: 'native-photo',
        metadata: { format: 'jpeg' },
      },
    ],
  })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      blob: async () => new Blob(['photo'], { type: 'image/jpeg' }),
    }),
  )
  mount()
  click('Take or choose a photo')
  await waitFor(() => expect(mocks.camera).toHaveBeenCalled())
  expect(mocks.identify).not.toHaveBeenCalled()
  click('Search')
  await waitFor(() => expect(mocks.identify).toHaveBeenCalled())
  expect(mocks.camera).toHaveBeenCalledWith(
    expect.objectContaining({
      quality: 100,
      correctOrientation: true,
      includeMetadata: true,
    }),
  )
})
it('continues without a model after identification fails and retains the photo', async () => {
  mocks.identify.mockRejectedValue(new Error('Photo unavailable'))
  mount()
  fireEvent.change(screen.getByLabelText('Asset photo'), {
    target: { files: [photo] },
  })
  click('Search')
  await screen.findByText('Photo unavailable')
  clickFindMode('Model')
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
it('lets users uncheck AI connections and manually choose any boat equipment', async () => {
  mocks.connections.mockResolvedValue([
    { assetId: 'gps', reason: 'Position data' },
  ])
  mount()
  await find()
  await skipDocuments()
  click('Okay')
  await screen.findByText('GPS receiver')
  const checkbox = screen.getByRole<HTMLInputElement>('checkbox', {
    name: /GPS receiver/,
  })
  expect(checkbox.checked).toBe(true)
  fireEvent.click(checkbox)
  click('Add connection')
  fireEvent.click(screen.getByRole('radio', { name: /Water pump/ }))
  click('Add connection')
  click('Add equipment')
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      'boat',
      expect.objectContaining({
        confirmedConnections: [
          expect.objectContaining({
            assetId: 'pump',
            reason: 'Connection selected by the user.',
          }),
        ],
      }),
      undefined,
    ),
  )
})
it('keeps catalog network suggestions checked on the review step', async () => {
  mocks.connections.mockResolvedValue([
    {
      assetId: 'net_boat_seatal_kng',
      name: 'SeaTalkNG',
      kind: 'network',
      connectionType: 'cable',
      reason: 'Product has 2 × SeaTalkNG connections',
    },
  ])
  mount()
  await find()
  await skipDocuments()
  click('Okay')
  const checkbox = await screen.findByRole<HTMLInputElement>('checkbox', {
    name: /SeaTalkNG/,
  })
  expect(checkbox.checked).toBe(true)
  click('Add equipment')
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      'boat',
      expect.objectContaining({
        confirmedConnections: [
          expect.objectContaining({
            assetId: 'net_boat_seatal_kng',
            connectionType: 'cable',
          }),
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
  clickFindMode('Model')
  enter('Brand', 'Garmin')
  enter('Model', '923')
  click('Search')
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
  clickFindMode('Model')
  const brand = screen.getByRole('combobox', { name: 'Brand' })
  fireEvent.focus(brand)
  fireEvent.change(brand, { target: { value: 'Gar' } })
  await screen.findByRole('option', { name: 'Garmin' })
  fireEvent.keyDown(brand, { key: 'ArrowDown' })
  fireEvent.keyDown(brand, { key: 'Enter' })
  expect(screen.getByRole('img', { name: 'Garmin' })).toBeTruthy()
  enter('Model', '923')
  click('Search')
  await waitFor(() =>
    expect(mocks.resolve).toHaveBeenCalledWith(
      'Garmin',
      '923',
      'en',
      expect.anything(),
      { productId: 'product' },
    ),
  )
})
it('requires picking an exact model when the catalog search is ambiguous', async () => {
  const alt: CatalogProduct = {
    ...product,
    id: 'product-500',
    modelNumber: 'SCC110050120',
    info: {
      name: 'SmartShunt 500A',
      description: '500 A shunt',
      category: 'Electrical',
      specifications: [{ name: 'Current', value: '500', unit: 'A' }],
      sources: [],
    },
  }
  mocks.models.mockResolvedValue({
    products: [product, alt],
    exact: false,
    ambiguous: true,
  })
  mount()
  clickFindMode('Model')
  enter('Brand', 'Garmin')
  enter('Model', 'smart shunt')
  click('Search')
  await screen.findByText('Choose the exact model')
  expect(
    screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled'),
  ).toBe(true)
  fireEvent.click(screen.getByText('SCC110050120'))
  await waitFor(() =>
    expect(mocks.resolve).toHaveBeenCalledWith(
      'Garmin',
      'SCC110050120',
      'en',
      expect.any(AbortSignal),
      { productId: 'product-500' },
    ),
  )
})
it('lets the user pick or correct search terms when AI model lookup is ambiguous', async () => {
  const first: CatalogProduct = {
    ...product,
    id: 'shu-300',
    brand: 'Victron Energy',
    modelNumber: 'SHU050130050',
    imageUrl: '/api/products/shu-300/resources/img/content?display=1',
    info: {
      name: 'SmartShunt 300A IP65',
      description: 'Battery monitor',
      category: 'Electrical',
      specifications: [{ name: 'Current', value: '300', unit: 'A' }],
      sources: [],
    },
  }
  const second: CatalogProduct = {
    ...first,
    id: 'shu-500',
    modelNumber: 'SHU050150050',
    imageUrl: '/api/products/shu-500/resources/img/content?display=1',
    info: {
      name: 'SmartShunt 500A IP65',
      description: 'Larger shunt',
      category: 'Electrical',
      specifications: [{ name: 'Current', value: '500', unit: 'A' }],
      sources: [],
    },
  }
  mocks.models.mockResolvedValue({
    products: [],
    exact: false,
    ambiguous: false,
  })
  mocks.modelOptions.mockResolvedValue({
    brandCorrect: true,
    brandGuesses: [],
    ambiguous: true,
    options: [],
    products: [first, second],
  })
  mount()
  clickFindMode('Model')
  enter('Brand', 'Raymarine')
  enter('Model', 'smart shunt 300a ip65')
  click('Search')
  await screen.findByText('Choose the exact model')
  expect(
    document.querySelector('img[src*="/api/products/shu-300/"]'),
  ).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled'),
  ).toBe(true)
  expect(screen.getByRole('button', { name: 'Search again' })).toBeTruthy()
  fireEvent.click(screen.getByText('SHU050130050'))
  await waitFor(() =>
    expect(mocks.resolve).toHaveBeenCalledWith(
      'Victron Energy',
      'SHU050130050',
      'en',
      expect.any(AbortSignal),
      { productId: 'shu-300' },
    ),
  )
})
it('offers brand guesses when the typed manufacturer is wrong', async () => {
  mocks.models
    .mockResolvedValueOnce({ products: [], exact: false, ambiguous: false })
    .mockResolvedValueOnce({
      products: [product],
      exact: true,
      ambiguous: false,
    })
  mocks.modelOptions.mockResolvedValue({
    brandCorrect: false,
    brandGuesses: ['Victron Energy'],
    ambiguous: true,
    options: [
      {
        brand: 'Victron Energy',
        modelNumber: 'SHU050130050',
        name: 'SmartShunt 300A IP65',
        description: 'Battery monitor',
        imageUrl: 'https://example.com/300.png',
        productPageUrl: null,
        specifications: [],
      },
    ],
  })
  mount()
  clickFindMode('Model')
  enter('Brand', 'Raymarine')
  enter('Model', 'smart shunt 300a ip65')
  click('Search')
  await screen.findByText(
    'This does not look like a Raymarine product. Did you mean one of these brands?',
  )
  fireEvent.click(screen.getByRole('button', { name: /^Victron Energy$/ }))
  await waitFor(() =>
    expect(mocks.models).toHaveBeenLastCalledWith(
      'Victron Energy',
      'smart shunt 300a ip65',
      'en',
      expect.any(AbortSignal),
    ),
  )
})
it('uses a single unambiguous AI match automatically', async () => {
  mocks.models.mockResolvedValue({
    products: [],
    exact: false,
    ambiguous: false,
  })
  mocks.modelOptions.mockResolvedValue({
    brandCorrect: true,
    brandGuesses: [],
    ambiguous: false,
    options: [],
    products: [
      {
        ...product,
        id: 'gpsmap',
        modelNumber: 'GPSMAP 923',
        imageUrl: '/api/products/gpsmap/resources/img/content?display=1',
      },
    ],
  })
  mount()
  clickFindMode('Model')
  enter('Brand', 'Garmin')
  enter('Model', '923 chartplotter')
  click('Search')
  await screen.findByText('Is this your equipment?')
  expect(mocks.resolve).toHaveBeenCalledWith(
    'Garmin',
    'GPSMAP 923',
    'en',
    expect.any(AbortSignal),
    { productId: 'gpsmap' },
  )
})
it('disables search until there is a photo or brand and model', () => {
  mount()
  expect(
    screen.getByRole('button', { name: 'Search' }).hasAttribute('disabled'),
  ).toBe(true)
  fireEvent.change(screen.getByLabelText('Asset photo'), {
    target: { files: [photo] },
  })
  expect(
    screen.getByRole('button', { name: 'Search' }).hasAttribute('disabled'),
  ).toBe(false)
  clickFindMode('Model')
  expect(
    screen.getByRole('button', { name: 'Search' }).hasAttribute('disabled'),
  ).toBe(true)
  enter('Brand', 'Garmin')
  enter('Model', '923')
  expect(
    screen.getByRole('button', { name: 'Search' }).hasAttribute('disabled'),
  ).toBe(false)
})
it('identifies equipment from a product link', async () => {
  mocks.identifyLink.mockResolvedValue({
    name: 'Chartplotter',
    brand: 'Garmin',
    modelNumber: '923',
    description: 'Marine display',
    category: 'Navigation',
    confidence: 'high',
  })
  mount()
  clickFindMode('Link')
  fireEvent.change(screen.getByLabelText('Product link'), {
    target: { value: 'https://example.com/garmin-923' },
  })
  click('Search')
  await screen.findByText('Is this your equipment?')
  expect(mocks.identifyLink).toHaveBeenCalledWith(
    'boat',
    'https://example.com/garmin-923',
    expect.any(AbortSignal),
  )
  expect(mocks.resolve).toHaveBeenCalledWith(
    'Garmin',
    '923',
    'en',
    expect.any(AbortSignal),
    {
      sourceUrl: 'https://example.com/garmin-923',
      photoUrl: null,
      productId: 'product',
    },
  )
})
it('requires confirmation to discard and never closes on backdrop taps', () => {
  mount()
  clickFindMode('Model')
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
