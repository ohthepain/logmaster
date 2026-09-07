import { describe, expect, it } from 'vitest'
import { boatDocumentOpenTarget } from './boat-document-open'
import {
  getBoatDocumentViewKind,
  isBoatDocumentViewable,
} from './boat-document-viewer'
import type { BoatDocument } from '../domain/boat'

function uploadDocument(
  overrides: Partial<BoatDocument['currentVersion']> = {},
): BoatDocument {
  return {
    id: 'doc-1',
    boatId: 'boat-1',
    categoryId: 'cat-1',
    title: 'Manual',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    currentVersion: {
      id: 'ver-1',
      documentId: 'doc-1',
      versionNumber: 1,
      kind: 'upload',
      mimeType: 'application/pdf',
      url: null,
      fileName: 'manual.pdf',
      createdAt: '2026-01-01T00:00:00.000Z',
      contentUrl: '/api/boats/documents/versions/ver-1/content',
      ...overrides,
    },
  }
}

describe('boat document viewer', () => {
  it('detects pdf uploads', () => {
    const target = boatDocumentOpenTarget(uploadDocument())
    expect(getBoatDocumentViewKind(target)).toBe('pdf')
    expect(isBoatDocumentViewable(target)).toBe(true)
  })

  it('detects image uploads', () => {
    const target = boatDocumentOpenTarget(
      uploadDocument({
        mimeType: 'image/png',
        fileName: 'scan.png',
      }),
    )
    expect(getBoatDocumentViewKind(target)).toBe('image')
  })

  it('detects text uploads', () => {
    const target = boatDocumentOpenTarget(
      uploadDocument({
        mimeType: 'text/plain',
        fileName: 'notes.txt',
      }),
    )
    expect(getBoatDocumentViewKind(target)).toBe('text')
  })

  it('detects office documents as embed', () => {
    const target = boatDocumentOpenTarget(
      uploadDocument({
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: 'registration.docx',
      }),
    )
    expect(getBoatDocumentViewKind(target)).toBe('embed')
  })

  it('returns null for unsupported uploads', () => {
    const target = boatDocumentOpenTarget(
      uploadDocument({
        mimeType: 'application/zip',
        fileName: 'archive.zip',
      }),
    )
    expect(getBoatDocumentViewKind(target)).toBeNull()
    expect(isBoatDocumentViewable(target)).toBe(false)
  })
})
