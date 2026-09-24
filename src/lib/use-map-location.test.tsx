// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMapLocation } from './use-map-location'
import type { DevicePositionResult } from './device-position'

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  request: vi.fn(),
  subscribe: vi.fn(),
}))
vi.mock('./device-position', () => ({
  checkLocationPermission: mocks.check,
  requestDevicePosition: mocks.request,
  subscribeToDevicePosition: mocks.subscribe,
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.subscribe.mockReturnValue(() => {})
  mocks.check.mockResolvedValue('prompt')
})
afterEach(cleanup)

describe('map location permission flow', () => {
  it('waits for Continue before opening the system prompt, then separates the first fix', async () => {
    let finish!: (result: DevicePositionResult) => void
    let locating!: () => void
    mocks.request.mockImplementation((onLocating) => {
      locating = onLocating
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    const { result } = renderHook(() => useMapLocation(true))
    await waitFor(() => expect(result.current.state).toBe('permission'))
    expect(mocks.request).not.toHaveBeenCalled()
    act(() => {
      void result.current.request()
    })
    expect(result.current.state).toBe('requesting')
    act(() => locating())
    expect(result.current.state).toBe('locating')
    await act(async () =>
      finish({
        status: 'success',
        position: {
          latitude: 36,
          longitude: -5,
          accuracy: 10,
          heading: null,
          timestamp: new Date().toISOString(),
        },
      }),
    )
    expect(result.current.state).toBe('ready')
  })

  it('skips the introduction when permission is already granted', async () => {
    mocks.check.mockResolvedValue('granted')
    mocks.request.mockImplementation((onLocating) => {
      onLocating()
      return new Promise(() => {})
    })
    const { result } = renderHook(() => useMapLocation(true))
    await waitFor(() => expect(result.current.state).toBe('locating'))
    expect(mocks.request).toHaveBeenCalledOnce()
  })

  it('does not request denied permission again on mount', async () => {
    mocks.check.mockResolvedValue('denied')
    const { result } = renderHook(() => useMapLocation(true))
    await waitFor(() => expect(result.current.state).toBe('denied'))
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('keeps browsing after a dismissed request eventually finishes', async () => {
    let finish!: (result: DevicePositionResult) => void
    mocks.request.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { result } = renderHook(() => useMapLocation(true))
    await waitFor(() => expect(result.current.state).toBe('permission'))
    act(() => {
      void result.current.request()
    })
    act(() => result.current.browse())
    await act(async () => finish({ status: 'timeout' }))
    expect(result.current.state).toBe('browsing')
  })

  it('keeps historical maps quiet until location is explicitly requested', async () => {
    const { result } = renderHook(() => useMapLocation(false))
    expect(result.current.state).toBe('idle')
    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('rechecks permission on returning from Settings', async () => {
    mocks.check.mockResolvedValue('denied')
    const { result } = renderHook(() => useMapLocation(true))
    await waitFor(() => expect(result.current.state).toBe('denied'))
    mocks.check.mockResolvedValue('granted')
    mocks.request.mockResolvedValue({ status: 'timeout' })
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(result.current.state).toBe('timeout'))
  })
})

it('does not cover the map again if a live fix arrives before the one-shot times out', async () => {
  let finish!: (result: DevicePositionResult) => void
  mocks.check.mockResolvedValue('granted')
  mocks.request.mockImplementation((onLocating) => {
    onLocating()
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  const { result } = renderHook(() => useMapLocation(true))
  await waitFor(() => expect(result.current.state).toBe('locating'))
  act(() => mocks.subscribe.mock.calls[0][0]())
  expect(result.current.state).toBe('ready')
  await act(async () => finish({ status: 'timeout' }))
  expect(result.current.state).toBe('ready')
})
