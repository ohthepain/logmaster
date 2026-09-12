// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddAssetModal } from './AddAssetModal'

const mocks = vi.hoisted(() => ({
  identify: vi.fn(),
  research: vi.fn(),
  create: vi.fn(),
  camera: vi.fn(),
  native: vi.fn(),
}))
vi.mock('../lib/boat-assets-api', () => ({
  createBoatAsset: mocks.create,
  identifyAssetPhoto: mocks.identify,
  researchNewAsset: mocks.research,
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
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const photo = new File(['photo'], 'pump.jpg', { type: 'image/jpeg' })
const props = {
  boatId: 'boat',
  boatName: 'Boat',
  orgName: null,
  members: [],
  assets: [{ id: 'tank', name: 'Water tank' }],
  onClose: vi.fn(),
  onCreated: vi.fn(),
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
  mocks.research.mockResolvedValue({
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
  })
  mocks.create.mockResolvedValue({ id: 'created' })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function selectPhoto() {
  fireEvent.change(screen.getByLabelText('Asset photo'), {
    target: { files: [photo] },
  })
  await waitFor(() =>
    expect(screen.getByLabelText<HTMLInputElement>('Model number').value).toBe(
      'P123',
    ),
  )
}

describe('photo asset review', () => {
  it('requires model confirmation, leaves connections unchecked, and retains the photo', async () => {
    render(<AddAssetModal {...props} />)
    await selectPhoto()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Add asset' })
        .disabled,
    ).toBe(true)
    expect(mocks.research).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm model number' }),
    )
    await screen.findByText('Water tank')
    const checkbox = screen.getByRole<HTMLInputElement>('checkbox')
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
        }),
        photo,
      ),
    )
  })
  it('uses no model number for research and saving when the user rejects the match', async () => {
    render(<AddAssetModal {...props} />)
    await selectPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'No model number' }))
    await screen.findByText('Water tank')
    expect(mocks.research).toHaveBeenCalledWith(
      'boat',
      expect.objectContaining({ modelNumber: null }),
      expect.any(AbortSignal),
    )
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
    render(<AddAssetModal {...props} />)
    await selectPhoto()
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm model number' }),
    )
    await screen.findByText('Water tank')
    fireEvent.click(screen.getByRole('checkbox'))
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
  it('can save a manual description and photo after identification and research fail', async () => {
    mocks.identify.mockRejectedValue(new Error('AI unavailable'))
    mocks.research.mockRejectedValue(new Error('Search unavailable'))
    render(<AddAssetModal {...props} />)
    fireEvent.change(screen.getByLabelText('Asset photo'), {
      target: { files: [photo] },
    })
    await screen.findByText('AI unavailable')
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Red pump in bilge' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'No model number' }))
    await screen.findByText('Search unavailable')
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
  it('opens the native camera with CameraSource.Camera', async () => {
    mocks.native.mockReturnValue(true)
    mocks.camera.mockResolvedValue({ webPath: 'native-photo', format: 'jpeg' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        blob: async () => new Blob(['photo'], { type: 'image/jpeg' }),
      }),
    )
    render(<AddAssetModal {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }))
    await waitFor(() => expect(mocks.identify).toHaveBeenCalled())
    expect(mocks.camera).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'CAMERA', saveToGallery: false }),
    )
  })
})
