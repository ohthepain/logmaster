import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearDevPositionOverride,
  getLastKnownDevicePosition,
  readDevicePosition,
  resetDevicePositionForTests,
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
    resetDevicePositionForTests()
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
    resetDevicePositionForTests()
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

describe('last known position', () => {
  const store = new Map<string, string>()

  afterEach(() => {
    store.clear()
    resetDevicePositionForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps a real fix for the next time the map opens', async () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    })
    stubGeolocation((success) => {
      success({
        coords: {
          latitude: 36.14,
          longitude: 15.02,
          accuracy: 8,
          heading: 90,
          altitude: null,
          altitudeAccuracy: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition)
    })

    await readDevicePosition({ force: true })
    const saved = localStorage.getItem('logmaster.lastKnownPosition')
    resetDevicePositionForTests()
    localStorage.setItem('logmaster.lastKnownPosition', saved ?? '')

    expect(getLastKnownDevicePosition()).toMatchObject({
      latitude: 36.14,
      longitude: 15.02,
      heading: 90,
    })
  })
})
