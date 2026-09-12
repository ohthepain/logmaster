import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearDevPositionOverride,
  readDevicePosition,
  setDevPositionOverride,
  setLocationAccessEnabled,
  subscribeToDevicePosition,
} from './device-position'

function stubGeolocation(
  getCurrentPosition: (
    success: PositionCallback,
    error?: PositionErrorCallback,
  ) => void,
) {
  const geolocation = {
    getCurrentPosition: vi.fn(getCurrentPosition),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  }
  vi.stubGlobal('navigator', { geolocation })
  return geolocation
}

describe('dev position override', () => {
  afterEach(() => {
    clearDevPositionOverride()
    setLocationAccessEnabled(false)
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

    stubGeolocation((_success, error) => {
      error?.({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    })
    setLocationAccessEnabled(true)

    const position = await readDevicePosition({ force: true })

    expect(position.latitude).toBeCloseTo(50.7628, 4)
    expect(position.longitude).toBeCloseTo(-1.2974, 4)
  })
})

describe('location access gate', () => {
  afterEach(() => {
    clearDevPositionOverride()
    setLocationAccessEnabled(false)
    vi.restoreAllMocks()
  })

  it('requests a one-shot position even while recording is paused', async () => {
    const geolocation = stubGeolocation((success) => {
      success({
        coords: {
          latitude: 51.5,
          longitude: -0.12,
          accuracy: 12,
          heading: null,
          altitude: null,
          altitudeAccuracy: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition)
    })
    setLocationAccessEnabled(false)

    const position = await readDevicePosition({ force: true })

    expect(geolocation.getCurrentPosition).toHaveBeenCalled()
    expect(geolocation.watchPosition).not.toHaveBeenCalled()
    expect(position.latitude).toBe(51.5)
    expect(position.longitude).toBe(-0.12)
  })

  it('does not start a GPS watch while recording is paused', () => {
    const geolocation = stubGeolocation((_success, error) => {
      error?.({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    })
    setLocationAccessEnabled(false)

    const unsubscribe = subscribeToDevicePosition(() => {})
    expect(geolocation.watchPosition).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('requests geolocation after recording starts', async () => {
    const geolocation = stubGeolocation((_success, error) => {
      error?.({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    })
    setLocationAccessEnabled(true)

    await readDevicePosition({ force: true })

    expect(geolocation.getCurrentPosition).toHaveBeenCalled()
  })

  it('starts a GPS watch after recording starts', () => {
    const geolocation = stubGeolocation((_success, error) => {
      error?.({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    })
    setLocationAccessEnabled(true)

    const unsubscribe = subscribeToDevicePosition(() => {})
    expect(geolocation.watchPosition).toHaveBeenCalled()
    unsubscribe()
  })
})
