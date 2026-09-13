import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAssetWithAttachments,
  attachSuggestedDownload,
} from './asset-storage'
import { createAssetSchema } from './asset-intelligence-schema'

const mocks = vi.hoisted(() => {
  const tx = {
    boatAsset: { count: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
    assetConnection: { create: vi.fn() },
    boatDocumentCategory: { upsert: vi.fn() },
    boatDocument: { create: vi.fn() },
    assetSuggestedDownload: { findUnique: vi.fn(), update: vi.fn() },
    $queryRaw: vi.fn(),
  }
  return {
    tx,
    transaction: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    normalize: vi.fn(),
    download: vi.fn(),
    suggestion: vi.fn(),
  }
})
vi.mock('./db', () => ({
  prisma: {
    $transaction: mocks.transaction,
    assetSuggestedDownload: { findFirst: mocks.suggestion },
  },
}))
vi.mock('./s3-photos', () => ({
  boatDocumentS3Key: () => 'photo-key',
  uploadPhotoObject: mocks.upload,
  deletePhotoObject: mocks.remove,
}))
vi.mock('./asset-original-photo', () => ({
  prepareOriginalAssetPhoto: mocks.normalize,
}))
vi.mock('./product-catalog', () => ({
  resolveProduct: vi.fn(async () => ({ id: 'shared-product' })),
}))
vi.mock('./asset-download', () => ({ downloadAssetDocument: mocks.download }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.transaction.mockImplementation((run) => run(mocks.tx))
  mocks.tx.boatAsset.count.mockResolvedValue(0)
  mocks.tx.boatAsset.aggregate.mockResolvedValue({ _max: { sortOrder: null } })
  mocks.tx.boatDocumentCategory.upsert.mockResolvedValue({ id: 'photos' })
  mocks.normalize.mockResolvedValue({
    original: Buffer.from('original-photo'),
    preview: Buffer.from('preview-photo'),
    mimeType: 'image/jpeg',
    extension: 'jpg',
  })
  mocks.remove.mockResolvedValue(undefined)
})

describe('asset creation', () => {
  it('saves a photo with a description even without a model number', async () => {
    const data = createAssetSchema.parse({
      name: 'Cabin pump',
      description: 'Water pump below sink',
      ownership: 'BOAT',
      modelNumber: null,
      category: 'Plumbing',
    })
    await createAssetWithAttachments(
      'boat',
      'user',
      data,
      new File(['photo'], 'photo.jpg'),
    )
    expect(mocks.tx.boatAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelNumber: null,
          category: 'Plumbing',
        }),
      }),
    )
    expect(mocks.tx.boatDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purpose: 'photo',
          assetLinks: expect.anything(),
        }),
      }),
    )
    expect(mocks.tx.assetConnection.create).not.toHaveBeenCalled()
  })
  it('rejects cross-boat connections and removes the staged photo', async () => {
    const data = createAssetSchema.parse({
      name: 'Pump',
      ownership: 'BOAT',
      confirmedConnections: [
        { assetId: 'other-boat-asset', reason: 'Water supply' },
      ],
    })
    await expect(
      createAssetWithAttachments(
        'boat',
        'user',
        data,
        new File(['photo'], 'photo.jpg'),
      ),
    ).rejects.toThrow('no longer exists')
    expect(mocks.tx.boatAsset.create).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledWith('photo-key')
  })
  it('saves only supplied confirmations, using canonical edge order', async () => {
    mocks.tx.boatAsset.count.mockResolvedValue(1)
    const data = createAssetSchema.parse({
      name: 'Pump',
      ownership: 'BOAT',
      confirmedConnections: [{ assetId: 'existing', reason: 'Supplies water' }],
    })
    const id = await createAssetWithAttachments('boat', 'user', data)
    const [fromAssetId, toAssetId] = [id, 'existing'].sort()
    expect(mocks.tx.assetConnection.create).toHaveBeenCalledWith({
      data: {
        fromAssetId,
        toAssetId,
        reason: 'Supplies water',
        confirmedBy: 'user',
      },
    })
  })
})

describe('download attachment retries', () => {
  it('does not download a suggestion already attached', async () => {
    mocks.suggestion.mockResolvedValue({ documentId: 'existing-doc' })
    expect(
      await attachSuggestedDownload('boat', 'asset', 'suggestion', 'user'),
    ).toBe('existing-doc')
    expect(mocks.download).not.toHaveBeenCalled()
  })
  it('discards a duplicate upload after another request attaches the document', async () => {
    mocks.suggestion.mockResolvedValue({
      documentId: null,
      url: 'https://example.com/manual.pdf',
    })
    mocks.download.mockResolvedValue({
      buffer: Buffer.from('%PDF-'),
      mimeType: 'application/pdf',
      extension: 'pdf',
    })
    mocks.tx.assetSuggestedDownload.findUnique.mockResolvedValue({
      documentId: 'other-request-doc',
    })
    expect(
      await attachSuggestedDownload('boat', 'asset', 'suggestion', 'user'),
    ).toBe('other-request-doc')
    expect(mocks.tx.$queryRaw).toHaveBeenCalled()
    expect(mocks.tx.boatDocument.create).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledWith('photo-key')
  })
})

it('persists canonical brands with clean model and product names', async () => {
  await createAssetWithAttachments(
    'boat',
    'user',
    createAssetSchema.parse({
      name: 'Quark-Elec QK-A026-Plus NMEA 2000 AIS+GPS Receiver',
      brand: 'Quark Elec',
      modelNumber: 'Quark-Elec QK-A026-Plus',
      ownership: 'BOAT',
    }),
  )
  expect(mocks.tx.boatAsset.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        brand: 'Quark-Elec',
        modelNumber: 'QK-A026-Plus',
        name: 'NMEA 2000 AIS+GPS Receiver',
      }),
    }),
  )
})
