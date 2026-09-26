import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  awaitFreshDevicePosition,
  checkLocationPermission,
  readDevicePosition,
  requestDevicePosition,
  resetDevicePositionForTests,
  subscribeToDevicePosition,
} from './device-position'

const mocks = vi.hoisted(() => ({
  native: vi.fn(),
  check: vi.fn(),
  request: vi.fn(),
  position: vi.fn(),
  watch: vi.fn(),
  clearWatch: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.native },
}))
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: mocks.check,
    requestPermissions: mocks.request,
    getCurrentPosition: mocks.position,
    watchPosition: mocks.watch,
    clearWatch: mocks.clearWatch,
  },
}))
beforeEach(() => {
  resetDevicePositionForTests()
  mocks.native.mockReset()
  mocks.check.mockReset()
  mocks.request.mockReset()
  mocks.position.mockReset()
  mocks.watch.mockReset()
  mocks.clearWatch.mockReset()
  mocks.native.mockReturnValue(false)
  mocks.watch.mockResolvedValue('watch-1')
  mocks.clearWatch.mockResolvedValue(undefined)
  vi.stubGlobal('window', { isSecureContext: true })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function browser(errorCode?: number) {
  const getCurrentPosition = vi.fn((_success, error) => {
    if (errorCode) error({ code: errorCode })
  })
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition },
    permissions: {
      query: vi.fn().mockResolvedValue({
        state: 'prompt',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    },
  })
  return getCurrentPosition
}

function nativeFix(accuracy = 10) {
  return {
    coords: {
      latitude: 51.5,
      longitude: -0.12,
      accuracy,
      heading: null,
    },
    timestamp: Date.now(),
  }
}

describe('permission-aware device position', () => {
  it('checks browser permissions without requesting a fix', async () => {
    const get = browser()
    expect(await checkLocationPermission()).toBe('prompt')
    expect(get).not.toHaveBeenCalled()
    const unsubscribe = subscribeToDevicePosition(() => {}, { passive: true })
    expect(get).not.toHaveBeenCalled()
    unsubscribe()
  })

  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('preserves browser error %s without dev fallback', async (code, status) => {
    browser(code)
    expect(await requestDevicePosition()).toEqual({ status })
  })

  it('returns the first fix without waiting for the other accuracy request', async () => {
    const get = browser()
    get.mockImplementationOnce((success) =>
      success({
        coords: { latitude: 36, longitude: -5, accuracy: 15, heading: null },
        timestamp: Date.now(),
      }),
    )
    const result = await requestDevicePosition()
    expect(result.status).toBe('success')
  })

  it('does not fall through to browser geolocation after native denial', async () => {
    const get = browser()
    mocks.native.mockReturnValue(true)
    mocks.check.mockResolvedValue({
      location: 'prompt',
      coarseLocation: 'prompt',
    })
    mocks.request.mockResolvedValue({
      location: 'denied',
      coarseLocation: 'denied',
    })
    expect(await requestDevicePosition()).toEqual({ status: 'denied' })
    expect(get).not.toHaveBeenCalled()
    expect(mocks.position).not.toHaveBeenCalled()
    expect(mocks.watch).not.toHaveBeenCalled()
  })

  it('announces native acquisition only after permission is granted', async () => {
    vi.useFakeTimers()
    mocks.native.mockReturnValue(true)
    mocks.check.mockResolvedValue({ location: 'granted' })
    mocks.watch.mockResolvedValue('watch-1')
    const locating = vi.fn()
    const promise = requestDevicePosition(locating)
    await vi.runAllTimersAsync()
    expect(locating).toHaveBeenCalledOnce()
    expect(await promise).toEqual({ status: 'timeout' })
    expect(mocks.watch).toHaveBeenCalled()
    expect(mocks.position).not.toHaveBeenCalled()
  })
})

describe('native watch acquisition', () => {
  beforeEach(() => {
    mocks.native.mockReturnValue(true)
    mocks.check.mockResolvedValue({ location: 'granted' })
  })

  it('acquires a fix via watchPosition instead of getCurrentPosition', async () => {
    mocks.watch.mockImplementation(async (_opts, callback) => {
      callback(nativeFix())
      return 'watch-1'
    })

    const result = await requestDevicePosition()

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.position.latitude).toBe(51.5)
    }
    expect(mocks.watch).toHaveBeenCalled()
    expect(mocks.position).not.toHaveBeenCalled()
  })

  it('returns stale cache on force read and starts background refinement', async () => {
    mocks.watch.mockImplementation(async (_opts, callback) => {
      callback(nativeFix())
      return 'watch-1'
    })
    await requestDevicePosition()

    mocks.watch.mockClear()

    const immediate = await readDevicePosition({ force: true })
    expect(immediate.latitude).toBe(51.5)
    await vi.waitUntil(() => mocks.watch.mock.calls.length > 0)
    expect(mocks.watch).toHaveBeenCalled()
    expect(mocks.position).not.toHaveBeenCalled()
  })

  it('awaitFreshDevicePosition blocks for a new watch fix even when cache exists', async () => {
    mocks.watch.mockImplementation(async (_opts, callback) => {
      callback(nativeFix(10))
      return 'watch-1'
    })
    await requestDevicePosition()

    mocks.watch.mockImplementation(async (_opts, callback) => {
      callback({
        coords: {
          latitude: 52,
          longitude: -1,
          accuracy: 12,
          heading: null,
        },
        timestamp: Date.now(),
      })
      return 'watch-2'
    })

    const fresh = await awaitFreshDevicePosition()
    expect(fresh.latitude).toBe(52)
    expect(fresh.accuracy).toBe(12)
    expect(mocks.position).not.toHaveBeenCalled()
  })
})
