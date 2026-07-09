import { describe, expect, it } from 'vitest'
import { DEV_FALLBACK_POSITION } from './logbook-context'

describe('DEV_FALLBACK_POSITION', () => {
  it('provides a fixed Cowes coordinate for local development', () => {
    expect(DEV_FALLBACK_POSITION.latitude).toBeCloseTo(50.7628, 4)
    expect(DEV_FALLBACK_POSITION.longitude).toBeCloseTo(-1.2974, 4)
  })
})
