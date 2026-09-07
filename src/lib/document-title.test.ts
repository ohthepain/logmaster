import { describe, expect, it } from 'vitest'
import {
  documentTitleFromFileName,
  documentTitleFromUrl,
  resolveDocumentLinkTitle,
} from './document-title'

describe('documentTitleFromFileName', () => {
  it('strips file extension', () => {
    expect(documentTitleFromFileName('insurance-policy.pdf')).toBe(
      'insurance-policy',
    )
  })

  it('falls back to full name when stripping leaves empty', () => {
    expect(documentTitleFromFileName('.env')).toBe('.env')
  })

  it('returns Document for blank input', () => {
    expect(documentTitleFromFileName('   ')).toBe('Document')
  })
})

describe('documentTitleFromUrl', () => {
  it('uses the last path segment', () => {
    expect(
      documentTitleFromUrl('https://example.com/docs/insurance-policy.pdf'),
    ).toBe('insurance policy')
  })

  it('falls back to hostname', () => {
    expect(documentTitleFromUrl('https://www.example.com/')).toBe('example.com')
  })
})

describe('resolveDocumentLinkTitle', () => {
  it('prefers a manual title', () => {
    expect(
      resolveDocumentLinkTitle('https://example.com/a.pdf', {
        title: 'My policy',
        pageTitle: 'Page title',
      }),
    ).toBe('My policy')
  })

  it('uses page title when manual title is blank', () => {
    expect(
      resolveDocumentLinkTitle('https://example.com/a.pdf', {
        pageTitle: 'Page title',
      }),
    ).toBe('Page title')
  })
})
