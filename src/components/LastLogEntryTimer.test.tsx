// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LastLogEntryTimer } from './LastLogEntryTimer'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-29T10:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('ticks across an hour and resets when the latest entry changes', () => {
  const { rerender } = render(
    <LastLogEntryTimer timestamp="2026-09-29T09:00:01Z" />,
  )
  expect(screen.getByRole('timer').textContent).toContain('59:59')
  act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByRole('timer').textContent).toContain('01:00:00')
  rerender(<LastLogEntryTimer timestamp="2026-09-29T10:00:01Z" />)
  expect(screen.getByRole('timer').textContent).toContain('00:00')
})

it('handles missing, invalid, future and multi-day timestamps', () => {
  const { rerender } = render(<LastLogEntryTimer />)
  expect(screen.getByText('No entries yet')).toBeTruthy()
  rerender(<LastLogEntryTimer timestamp="invalid" />)
  expect(screen.getByText('No entries yet')).toBeTruthy()
  rerender(<LastLogEntryTimer timestamp="2026-09-29T11:00:00Z" />)
  expect(screen.getByRole('timer').textContent).toContain('00:00')
  rerender(<LastLogEntryTimer timestamp="2026-09-27T08:57:56Z" />)
  expect(screen.getByRole('timer').textContent).toContain('2d 01:02:04')
})

it('catches up after the app resumes and cleans up its interval', () => {
  const { unmount } = render(
    <LastLogEntryTimer timestamp="2026-09-29T09:59:00Z" />,
  )
  act(() => {
    vi.setSystemTime(new Date('2026-09-29T10:30:00Z'))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(screen.getByRole('timer').textContent).toContain('31:00')
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
