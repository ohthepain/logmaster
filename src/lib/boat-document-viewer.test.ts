import { describe, expect, it } from 'vitest'
import { boatDocumentOpenTarget } from './boat-document-open'
import {
  extensionForBoatDocumentTarget,
  getBoatDocumentViewKind,
} from './boat-document-viewer'
import type { BoatDocument } from '../domain/boat'

function uploadDocument(fileName: string, mimeType: string): BoatDocument {
  return {
    id: 'doc-1',
    boatId: 'boat-1',
    categoryId: 'cat-1',
    title: 'Doc',
    purpose: null,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    currentVersion: {
      id: 'ver-1',
      documentId: 'doc-1',
      versionNumber: 1,
      kind: 'upload',
      mimeType,
      url: null,
      fileName,
      createdAt: '2026-01-01T00:00:00.000Z',
      contentUrl: '/api/boats/documents/versions/ver-1/content',
    },
  }
}

describe('extensionForBoatDocumentTarget', () => {
  it('uses the file name extension when available', () => {
    const target = boatDocumentOpenTarget(
      uploadDocument('policy.pdf', 'application/octet-stream'),
    )
    expect(extensionForBoatDocumentTarget(target)).toBe('pdf')
    expect(getBoatDocumentViewKind(target)).toBe('pdf')
  })
})
