// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useChatActivity } from './use-chat-activity'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  create: vi.fn(),
  native: vi.fn(),
  listener: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('../lib/api-client', () => ({ apiJson: mocks.api }))
vi.mock('../lib/messaging/realtime', () => ({
  createChatRealtime: mocks.create,
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.native },
}))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mocks.listener,
    getState: async () => ({ isActive: true }),
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  })
  mocks.api.mockResolvedValue({})
  mocks.native.mockReturnValue(false)
  mocks.connect.mockResolvedValue(undefined)
  mocks.disconnect.mockResolvedValue(undefined)
  mocks.create.mockResolvedValue({
    connect: mocks.connect,
    disconnect: mocks.disconnect,
  })
  mocks.listener.mockResolvedValue({ remove: mocks.remove })
})
afterEach(cleanup)
it('connects on chat mount, disconnects in background, reconnects on return, and cleans up on exit', async () => {
  const refresh = vi.fn()
  const { unmount } = renderHook(() => useChatActivity('user', refresh))
  await waitFor(() => expect(mocks.connect).toHaveBeenCalledOnce())
  act(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledOnce())
  expect(
    mocks.api.mock.calls.some(
      ([, init]) => JSON.parse(init.body).active === false,
    ),
  ).toBe(true)
  act(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(2))
  unmount()
  expect(mocks.disconnect).toHaveBeenCalledTimes(2)
})
it('does not connect if an asynchronous session arrives after leaving chat', async () => {
  let finish!: (value: unknown) => void
  mocks.create.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const refresh = vi.fn()
  const { unmount } = renderHook(() => useChatActivity('user', refresh))
  unmount()
  await act(async () => {
    finish({ connect: mocks.connect, disconnect: mocks.disconnect })
  })
  expect(mocks.connect).not.toHaveBeenCalled()
  expect(mocks.disconnect).toHaveBeenCalledOnce()
})
it('honors native app suspension even when document visibility is unchanged', async () => {
  mocks.native.mockReturnValue(true)
  const refresh = vi.fn()
  const { unmount } = renderHook(() => useChatActivity('user', refresh))
  await waitFor(() => expect(mocks.connect).toHaveBeenCalledOnce())
  act(() => mocks.listener.mock.calls[0][1]({ isActive: false }))
  await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledOnce())
  unmount()
  await waitFor(() => expect(mocks.remove).toHaveBeenCalled())
})
