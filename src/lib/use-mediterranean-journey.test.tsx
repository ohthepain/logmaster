// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GIBRALTAR, useMediterraneanJourney } from './use-mediterranean-journey'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('starts in Gibraltar, moves east, and pauses while a system prompt is open', async () => {
  const move = vi.fn()
  const { rerender, unmount } = renderHook(
    ({ moving }) => useMediterraneanJourney(true, true, moving, move),
    { initialProps: { moving: true } },
  )
  expect(move.mock.calls[0][0]).toEqual(GIBRALTAR)
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(move.mock.lastCall?.[0].longitude).toBeGreaterThan(GIBRALTAR.longitude)
  rerender({ moving: false })
  const count = move.mock.calls.length
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(move).toHaveBeenCalledTimes(count)
  unmount()
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(move).toHaveBeenCalledTimes(count)
})

it('keeps a still view with reduced motion enabled', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const move = vi.fn()
  renderHook(() => useMediterraneanJourney(true, true, true, move))
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(move).toHaveBeenCalledExactlyOnceWith(GIBRALTAR)
})
