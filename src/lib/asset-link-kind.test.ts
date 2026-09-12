import { describe, expect, it } from 'vitest'
import { assetLinkKindFromUrl } from './asset-link-kind'

describe('assetLinkKindFromUrl', () => {
  it('detects pdf and excel from path', () => {
    expect(assetLinkKindFromUrl('https://example.com/manuals/pump.pdf')).toBe(
      'pdf',
    )
    expect(assetLinkKindFromUrl('https://example.com/data/specs.xlsx')).toBe(
      'excel',
    )
  })

  it('treats pages without file extension as web links', () => {
    expect(
      assetLinkKindFromUrl('https://example.com/support/product/123'),
    ).toBe('web')
  })
})
