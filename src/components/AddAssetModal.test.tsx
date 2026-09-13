// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../lib/i18n'
import { AddAssetModal, findExistingBoatAsset } from './AddAssetModal'
import type { ListedBoatAsset } from './AddAssetModal'

const mocks = vi.hoisted(() => ({
  identify: vi.fn(),
  startResearchJob: vi.fn(),
  fetchResearchJob: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  camera: vi.fn(),
  native: vi.fn(),
}))
vi.mock('../lib/boat-assets-api', () => ({
  createBoatAsset: mocks.create,
  identifyAssetPhoto: mocks.identify,
  startAssetResearchJob: mocks.startResearchJob,
  fetchAssetResearchJob: mocks.fetchResearchJob,
  updateBoatAsset: mocks.update,
  uploadAndLinkAssetDocument: mocks.upload,
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.native },
}))
vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: mocks.camera },
  CameraSource: { Camera: 'CAMERA' },
  CameraResultType: { Uri: 'uri' },
}))
vi.mock('./Modal', () => ({
  Modal: ({
    children,
    onClose,
    closeOnOutside = true,
  }: {
    children: React.ReactNode
    onClose: () => void
    closeOnOutside?: boolean
  }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          if (closeOnOutside) onClose()
        }}
      >
        backdrop
      </button>
      {children}
    </div>
  ),
}))

const photo = new File(['photo'], 'pump.jpg', { type: 'image/jpeg' })
const props = {
  boatId: 'boat',
  boatName: 'Boat',
  orgName: null,
  members: [],
  assets: [
    {
      id: 'tank',
      name: 'Water tank',
      description: null,
      modelNumber: null,
      category: null,
    },
  ] satisfies ListedBoatAsset[],
  onClose: vi.fn(),
  onCreated: vi.fn(),
  onUpdated: vi.fn(),
  onOpenExisting: vi.fn(),
}

function renderModal(
  overrides: Partial<Omit<typeof props, 'assets'>> & {
    assets?: ListedBoatAsset[]
  } = {},
) {
  return render(
    <I18nProvider>
      <AddAssetModal {...props} {...overrides} />
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.native.mockReturnValue(false)
  URL.createObjectURL = vi.fn(() => 'blob:photo')
  URL.revokeObjectURL = vi.fn()
  mocks.identify.mockResolvedValue({
    name: 'Water pump',
    description: 'Fresh water pump',
    modelNumber: 'P123',
    confidence: 'high',
    category: 'Plumbing',
  })
  mocks.startResearchJob.mockResolvedValue({ jobId: 'job-1' })
  mocks.fetchResearchJob.mockResolvedValue({
    id: 'job-1',
    status: 'completed',
    error: null,
    result: {
      category: 'Plumbing',
      downloads: [
        {
          title: 'Installation guide',
          url: 'https://example.com/guide.pdf',
          purpose: 'manual',
          reason: 'Matches pump',
        },
      ],
      connections: [{ assetId: 'tank', reason: 'Water supplied by tank' }],
    },
  })
  mocks.create.mockResolvedValue({ id: 'created' })
  mocks.update.mockResolvedValue({ id: 'pump', name: 'Water pump' })
  mocks.upload.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function selectPhoto() {
  fireEvent.change(screen.getByLabelText('Asset photo'), {
    target: { files: [photo] },
  })
  expect(mocks.identify).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Auto-identify' }))
  await waitFor(() =>
    expect(screen.getByLabelText<HTMLInputElement>('Model number').value).toBe(
      'P123',
    ),
  )
}

describe('photo asset review', () => {
  it('leaves connections unchecked after Find documents and retains the photo', async () => {
    renderModal()
    await selectPhoto()
    expect(mocks.startResearchJob).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Find documents' }))
    await waitFor(() => expect(mocks.startResearchJob).toHaveBeenCalled())
    await screen.findByText('Water tank')
    const checkbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: /Water tank/,
    })
    expect(checkbox.checked).toBe(false)
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        'boat',
        expect.objectContaining({
          modelNumber: 'P123',
          confirmedConnections: [
            { assetId: 'tank', reason: 'Water supplied by tank' },
          ],
          researchJobId: 'job-1',
        }),
        photo,
      ),
    )
  })
  it('does not search until Find documents is tapped, and can save without it', async () => {
    renderModal()
    await selectPhoto()
    expect(mocks.startResearchJob).not.toHaveBeenCalled()
    const add = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Add asset',
    })
    expect(add.disabled).toBe(false)
    fireEvent.click(add)
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        'boat',
        expect.objectContaining({
          modelNumber: 'P123',
          suggestedDownloads: [],
          confirmedConnections: [],
        }),
        photo,
      ),
    )
  })
  it('hides Find documents without a model number and saves with a blank model', async () => {
    renderModal()
    await selectPhoto()
    fireEvent.change(screen.getByLabelText('Model number'), {
      target: { value: '' },
    })
    expect(screen.queryByRole('button', { name: 'Find documents' })).toBeNull()
    expect(mocks.startResearchJob).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        'boat',
        expect.objectContaining({
          modelNumber: null,
          confirmedConnections: [],
        }),
        photo,
      ),
    )
  })
  it('discards stale suggestions and confirmations when identity changes', async () => {
    renderModal()
    await selectPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Find documents' }))
    await screen.findByText('Water tank')
    fireEvent.click(screen.getByRole('checkbox', { name: /Water tank/ }))
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Actually a bilge pump' },
    })
    expect(screen.queryByText('Water tank')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        'boat',
        expect.objectContaining({
          confirmedConnections: [],
          suggestedDownloads: [],
        }),
        photo,
      ),
    )
  })
  it('can save without auto-identify when the user enters details manually', async () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('Asset photo'), {
      target: { files: [photo] },
    })
    expect(mocks.identify).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Red pump in bilge' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        'boat',
        expect.objectContaining({
          name: 'Red pump in bilge',
          modelNumber: null,
        }),
        photo,
      ),
    )
  })
  it('can save a manual description and photo after identification and research fail', async () => {
    mocks.identify.mockRejectedValue(new Error('AI unavailable'))
    renderModal()
    fireEvent.change(screen.getByLabelText('Asset photo'), {
      target: { files: [photo] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Auto-identify' }))
    await screen.findByText('AI unavailable')
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Red pump in bilge' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        'boat',
        expect.objectContaining({
          name: 'Red pump in bilge',
          modelNumber: null,
        }),
        photo,
      ),
    )
  })
  it('does not close when the backdrop is tapped', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'backdrop' }))
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('shows a spinner while identification is in progress', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.identify.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    renderModal()
    fireEvent.change(screen.getByLabelText('Asset photo'), {
      target: { files: [photo] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Auto-identify' }))
    expect(
      await screen.findByText('Identifying the device and reading its label…'),
    ).toBeTruthy()
    finish({
      name: 'Water pump',
      description: 'Fresh water pump',
      modelNumber: 'P123',
      confidence: 'high',
      category: 'Plumbing',
    })
    await waitFor(() =>
      expect(
        screen.queryByText('Identifying the device and reading its label…'),
      ).toBeNull(),
    )
  })

  it('offers open, overwrite, merge, or close when the equipment is already listed', async () => {
    renderModal({
      assets: [
        ...props.assets,
        {
          id: 'pump',
          name: 'Old pump',
          description: 'Needs service',
          modelNumber: 'P123',
          category: 'Plumbing',
        },
      ],
    })
    await selectPhoto()
    expect(
      screen.getByText('This equipment is already on the boat.'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add asset' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(props.onOpenExisting).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pump', modelNumber: 'P123' }),
    )
  })

  it('overwrites the existing asset and attaches the photo', async () => {
    renderModal({
      assets: [
        ...props.assets,
        {
          id: 'pump',
          name: 'Old pump',
          description: 'Needs service',
          modelNumber: 'P123',
          category: 'Plumbing',
        },
      ],
    })
    await selectPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        'boat',
        'pump',
        expect.objectContaining({
          name: 'Water pump',
          description: 'Fresh water pump',
          modelNumber: 'P123',
          category: 'Plumbing',
        }),
      ),
    )
    expect(mocks.upload).toHaveBeenCalledWith('boat', 'pump', photo, 'photo')
    expect(props.onUpdated).toHaveBeenCalled()
  })

  it('merges new details into the existing asset', async () => {
    renderModal({
      assets: [
        ...props.assets,
        {
          id: 'pump',
          name: 'Old pump',
          description: 'Needs service',
          modelNumber: 'P123',
          category: 'Plumbing',
        },
      ],
    })
    await selectPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        'boat',
        'pump',
        expect.objectContaining({
          name: 'Old pump',
          description: 'Needs service\n\nFresh water pump',
          modelNumber: 'P123',
          category: 'Plumbing',
        }),
      ),
    )
  })

  it('closes the add flow from the already-listed prompt', async () => {
    renderModal({
      assets: [
        ...props.assets,
        {
          id: 'pump',
          name: 'Old pump',
          description: null,
          modelNumber: 'P123',
          category: null,
        },
      ],
    })
    await selectPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('opens the native camera with CameraSource.Camera', async () => {
    mocks.native.mockReturnValue(true)
    mocks.camera.mockResolvedValue({ webPath: 'native-photo', format: 'jpeg' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        blob: async () => new Blob(['photo'], { type: 'image/jpeg' }),
      }),
    )
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Auto-identify' }),
      ).toBeTruthy(),
    )
    expect(mocks.identify).not.toHaveBeenCalled()
    expect(mocks.camera).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'CAMERA', saveToGallery: false }),
    )
  })
})

it('reviews a recognized brand separately from the model and product name', async () => {
  mocks.identify.mockResolvedValue({
    name: 'Quark-Elec QK-A026-Plus NMEA 2000 AIS+GPS Receiver',
    brand: 'Quark Elec',
    modelNumber: 'Quark-Elec QK-A026-Plus',
    description: '',
    confidence: 'high',
    category: 'Communications',
  })
  renderModal()
  fireEvent.change(screen.getByLabelText('Asset photo'), {
    target: { files: [photo] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Auto-identify' }))
  await screen.findByRole('img', { name: 'Quark-Elec' })
  expect(screen.getByLabelText<HTMLInputElement>('Model number').value).toBe(
    'QK-A026-Plus',
  )
  expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe(
    'NMEA 2000 AIS+GPS Receiver',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Find documents' }))
  await screen.findByText('Water tank')
  expect(mocks.startResearchJob).toHaveBeenCalledWith(
    'boat',
    expect.objectContaining({
      brand: 'Quark-Elec',
      modelNumber: 'QK-A026-Plus',
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add asset' }))
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      'boat',
      expect.objectContaining({
        brand: 'Quark-Elec',
        modelNumber: 'QK-A026-Plus',
        name: 'NMEA 2000 AIS+GPS Receiver',
      }),
      photo,
    ),
  )
})

it('allows a custom manufacturer and saves manually entered details', async () => {
  renderModal()
  fireEvent.change(screen.getByLabelText('Brand'), {
    target: { value: 'Custom Marine' },
  })
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Bilge pump' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add asset' }))
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      'boat',
      expect.objectContaining({ brand: 'Custom Marine', name: 'Bilge pump' }),
      undefined,
    ),
  )
})

it('matches legacy branded models without confusing different manufacturers', () => {
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
