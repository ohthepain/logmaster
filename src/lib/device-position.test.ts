import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearDevPositionOverride,
  readDevicePosition,
  setDevPositionOverride,
} from './device-position'

describe('dev position override', () => {
  afterEach(() => {
    clearDevPositionOverride()
    vi.restoreAllMocks()
  })

  it('readDevicePosition returns the dev override when set', async () => {
    setDevPositionOverride({ latitude: 51.5, longitude: -0.12 })

    const position = await readDevicePosition({ force: true })

    expect(position.latitude).toBe(51.5)
    expect(position.longitude).toBe(-0.12)
  })

  it('clearDevPositionOverride removes the fake position', async () => {
    setDevPositionOverride({ latitude: 51.5, longitude: -0.12 })
    clearDevPositionOverride()

    const geolocation = {
      getCurrentPosition: vi.fn((_success, error) => {
        error?.({ code: 1, message: 'denied' })
      }),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    }
    vi.stubGlobal('navigator', { geolocation })

    const position = await readDevicePosition({ force: true })

    expect(position.latitude).toBeCloseTo(50.7628, 4)
    expect(position.longitude).toBeCloseTo(-1.2974, 4)
  })
})
