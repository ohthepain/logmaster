import { describe, expect, it } from 'vitest'
import { sanitizeExportFileName } from './export-file'

describe('trip export filenames', () => {
  it('uses a single json extension for signalk exports', () => {
    expect(sanitizeExportFileName('My Trip signalk', 'json')).toBe('My-Trip-signalk.json')
  })

  it('encodes signalk json with content', () => {
    const content = '{"deltas":[]}'
    const bytes = new TextEncoder().encode(content)
    expect(bytes.byteLength).toBeGreaterThan(0)
  })
})
