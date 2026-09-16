import { describe, expect, it } from 'vitest'
import { resolveSeedProfile } from './manufacturers'

describe('resolveSeedProfile', () => {
  it('defaults to equipment', () => {
    expect(resolveSeedProfile(null)).toBe('equipment')
    expect(resolveSeedProfile(undefined)).toBe('equipment')
    expect(resolveSeedProfile('')).toBe('equipment')
  })

  it('accepts any manufacturer preset key', () => {
    expect(resolveSeedProfile('victron-energy')).toBe('victron-energy')
    expect(resolveSeedProfile('raymarine')).toBe('raymarine')
  })

  it('rejects unknown seeds with preset names in the error', () => {
    expect(() => resolveSeedProfile('not-a-brand')).toThrow(/raymarine/)
  })
})
