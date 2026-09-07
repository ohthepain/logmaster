import { describe, expect, it } from 'vitest'
import { extractPageTitle } from './link-page-title'

describe('extractPageTitle', () => {
  it('reads og:title', () => {
    const html =
      '<html><head><meta property="og:title" content="Insurance policy" /></head></html>'
    expect(extractPageTitle(html)).toBe('Insurance policy')
  })

  it('reads the document title tag', () => {
    const html = '<html><head><title>Registration docs</title></head></html>'
    expect(extractPageTitle(html)).toBe('Registration docs')
  })

  it('decodes basic entities', () => {
    const html = '<html><head><title>Tom &amp; Jerry</title></head></html>'
    expect(extractPageTitle(html)).toBe('Tom & Jerry')
  })
})
