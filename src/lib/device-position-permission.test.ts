import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkLocationPermission,
  requestDevicePosition,
  subscribeToDevicePosition,
} from './device-position'

const mocks = vi.hoisted(() => ({
  native: vi.fn(),
  check: vi.fn(),
  request: vi.fn(),
  position: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.native },
}))
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: mocks.check,
    requestPermissions: mocks.request,
    getCurrentPosition: mocks.position,
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.native.mockReturnValue(false)
})
afterEach(() => vi.unstubAllGlobals())

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
  })

  it('announces native acquisition only after permission is granted', async () => {
    mocks.native.mockReturnValue(true)
    mocks.check.mockResolvedValue({ location: 'prompt' })
    mocks.request.mockResolvedValue({ location: 'granted' })
    const locating = vi.fn()
    mocks.position.mockImplementation(() => {
      expect(locating).toHaveBeenCalledOnce()
      throw { code: 'OS-PLUG-GLOC-0010' }
    })
    expect(await requestDevicePosition(locating)).toEqual({ status: 'timeout' })
  })
})
