import { describe, expect, it } from 'vitest'
import { bottomSheetFullHeight, bottomSheetPeekHeight } from './safe-area'

describe('bottomSheetFullHeight', () => {
  it('keeps the expanded sheet below the app header', () => {
    const peek = bottomSheetPeekHeight(800, 0)
    expect(bottomSheetFullHeight(800, 80, peek)).toBe(720)
  })

  it('never shrinks below the peek height', () => {
    const peek = bottomSheetPeekHeight(400, 0)
    expect(bottomSheetFullHeight(400, 390, peek)).toBe(peek)
  })

  it('uses the full container when there is no header', () => {
    const peek = bottomSheetPeekHeight(600, 0)
    expect(bottomSheetFullHeight(600, 0, peek)).toBe(600)
  })
})
