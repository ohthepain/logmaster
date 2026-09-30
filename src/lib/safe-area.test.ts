import { describe, expect, it } from 'vitest'
import {
  bottomSheetFullHeight,
  bottomSheetPeekHeight,
  logbookSheetPeekHeight,
} from './safe-area'

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

describe('logbookSheetPeekHeight', () => {
  it('stays on the drag handle until the section header is measured', () => {
    expect(logbookSheetPeekHeight(null, 32)).toBe(32)
  })

  it('ends at the section header so log rows stay below the fold', () => {
    expect(logbookSheetPeekHeight(128.2, 32)).toBe(129)
  })

  it('never shrinks below the drag handle', () => {
    expect(logbookSheetPeekHeight(10, 32)).toBe(32)
  })
})
