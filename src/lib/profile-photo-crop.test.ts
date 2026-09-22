import { describe, expect, it } from 'vitest'
import {
  cropToPixelRect,
  defaultProfilePhotoCrop,
  moveProfilePhotoCrop,
  normalizeProfilePhotoCrop,
  resizeProfilePhotoCrop,
} from './profile-photo-crop'

describe('profile photo crop', () => {
  it('centers the default square crop', () => {
    const crop = defaultProfilePhotoCrop(1600, 900)
    const rect = cropToPixelRect(crop, 1600, 900)
    expect(rect.width).toBe(900)
    expect(rect.height).toBe(900)
    expect(rect.left).toBe(350)
    expect(rect.top).toBe(0)
  })

  it('clamps moves inside the image', () => {
    const crop = defaultProfilePhotoCrop(1000, 800)
    const moved = moveProfilePhotoCrop(crop, 1000, 800, -10_000, 10_000)
    const rect = cropToPixelRect(moved, 1000, 800)
    expect(rect.left).toBe(0)
    expect(rect.top).toBe(0)
    expect(rect.width).toBe(800)
  })

  it('keeps a minimum crop size when resizing', () => {
    const crop = defaultProfilePhotoCrop(500, 500)
    const shrunk = resizeProfilePhotoCrop(crop, 500, 500, -10_000)
    const rect = cropToPixelRect(
      normalizeProfilePhotoCrop(shrunk, 500, 500),
      500,
      500,
    )
    expect(rect.width).toBeGreaterThanOrEqual(40)
  })
})
