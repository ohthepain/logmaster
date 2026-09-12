import { describe, expect, it } from 'vitest'
import {
  contentTypeForStoredDocument,
  inlineContentDisposition,
} from './s3-photos'

describe('contentTypeForStoredDocument', () => {
  it('keeps an explicit document mime type', () => {
    expect(
      contentTypeForStoredDocument('application/pdf', 'scan.bin'),
    ).toBe('application/pdf')
  })

  it('infers pdf from the file name when the stored mime is generic', () => {
    expect(
      contentTypeForStoredDocument(
        'application/octet-stream',
        'Faktura 95748.pdf',
      ),
    ).toBe('application/pdf')
  })
})

describe('inlineContentDisposition', () => {
  it('includes a utf-8 filename for the PDF viewer title', () => {
    expect(inlineContentDisposition('Faktura 95748.pdf')).toContain(
      "filename*=UTF-8''Faktura%2095748.pdf",
    )
  })
})
