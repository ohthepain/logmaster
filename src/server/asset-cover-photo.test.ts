import { describe, expect, it } from 'vitest'
import {
  catalogProductImageUrl,
  pickAssetCoverPhoto,
  resolveAssetDisplayImageUrl,
} from './asset-cover-photo'

function doc(
  id: string,
  purpose: string | null,
  createdAt: Date,
  version: { id: string; mimeType: string; kind?: string },
) {
  return {
    document: {
      id,
      purpose,
      createdAt,
      versions: [
        {
          id: version.id,
          kind: version.kind ?? 'upload',
          mimeType: version.mimeType,
          fileName: 'photo.jpg',
          versionNumber: 1,
        },
      ],
    },
  }
}

describe('pickAssetCoverPhoto', () => {
  it('prefers earliest purpose=photo over later images', () => {
    const cover = pickAssetCoverPhoto([
      doc('d2', 'receipt', new Date('2026-02-02'), {
        id: 'v2',
        mimeType: 'image/jpeg',
      }),
      doc('d1', 'photo', new Date('2026-01-01'), {
        id: 'v1',
        mimeType: 'image/jpeg',
      }),
    ])
    expect(cover).toEqual({
      documentId: 'd1',
      contentUrl: '/api/boats/documents/versions/v1/content',
    })
  })

  it('falls back to earliest image when no photo purpose', () => {
    const cover = pickAssetCoverPhoto([
      doc('d2', 'other', new Date('2026-02-02'), {
        id: 'v2',
        mimeType: 'image/png',
      }),
      doc('d1', 'manual', new Date('2026-01-01'), {
        id: 'v1',
        mimeType: 'image/jpeg',
      }),
    ])
    expect(cover?.documentId).toBe('d1')
  })

  it('returns null when no image uploads', () => {
    expect(
      pickAssetCoverPhoto([
        doc('d1', 'manual', new Date('2026-01-01'), {
          id: 'v1',
          mimeType: 'application/pdf',
        }),
      ]),
    ).toBeNull()
  })
})

const verifiedProduct = {
  reviewStatus: 'verified',
  canonicalImageId: 'img-1',
  resources: [
    {
      id: 'img-1',
      displayS3Key: 'catalog/key',
      reviewStatus: 'verified',
    },
  ],
}

describe('resolveAssetDisplayImageUrl', () => {
  it('uses the asset photo when present', () => {
    const links = [
      doc('d1', 'photo', new Date('2026-01-01'), {
        id: 'v1',
        mimeType: 'image/jpeg',
      }),
    ]
    expect(
      resolveAssetDisplayImageUrl({
        documentLinks: links,
        productId: 'prod-1',
        product: verifiedProduct,
      }),
    ).toBe('/api/boats/documents/versions/v1/content')
  })

  it('falls back to the catalog product image', () => {
    expect(
      resolveAssetDisplayImageUrl({
        documentLinks: [],
        productId: 'prod-1',
        product: verifiedProduct,
      }),
    ).toBe('/api/products/prod-1/resources/img-1/content?display=1')
  })

  it('returns null when neither source has an image', () => {
    expect(
      resolveAssetDisplayImageUrl({
        documentLinks: [],
        productId: 'prod-1',
        product: { reviewStatus: 'rejected', canonicalImageId: null, resources: [] },
      }),
    ).toBeNull()
  })
})

describe('catalogProductImageUrl', () => {
  it('matches resolveAssetDisplayImageUrl catalog fallback', () => {
    expect(catalogProductImageUrl('prod-1', verifiedProduct)).toBe(
      '/api/products/prod-1/resources/img-1/content?display=1',
    )
  })
})
