import { describe, expect, it, vi } from 'vitest'
import {
  MAP_COVER_CAPTURE_TIMEOUT_MS,
  MAP_COVER_MAX_WIDTH,
  waitForMaplibreIdle,
} from './map-cover-capture'

describe('map-cover-capture', () => {
  it('exports a reasonable max cover width', () => {
    expect(MAP_COVER_MAX_WIDTH).toBeGreaterThanOrEqual(640)
    expect(MAP_COVER_MAX_WIDTH).toBeLessThanOrEqual(1600)
  })

  it('does not hang when the map is already idle', async () => {
    vi.useFakeTimers()
    const map = {
      loaded: () => true,
      isMoving: () => false,
      once: () => {},
      triggerRepaint: () => {},
    }

    const pending = waitForMaplibreIdle(map as never, 1000)
    await vi.advanceTimersByTimeAsync(MAP_COVER_CAPTURE_TIMEOUT_MS)
    await expect(pending).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
