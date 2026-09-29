// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { LogEntry } from '../domain/logbook'
import { TripLegSection } from './TripLegSection'

const { state } = vi.hoisted(() => ({
  state: {
    entries: [] as LogEntry[],
    legs: [
      {
        id: 'leg',
        tripId: 'trip',
        sequence: 0,
        startedAt: '2026-09-29T09:00:00Z',
      },
    ],
    updateLeg: vi.fn(),
    mergeLegWithPrevious: vi.fn(),
  },
}))
vi.mock('../stores/logbook', () => ({
  useLogbookStore: (selector: (value: typeof state) => unknown) =>
    selector(state),
}))
vi.mock('./DevComponentLabel', () => ({ DevComponentLabel: () => null }))
vi.mock('../lib/i18n', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const entry = (
  id: string,
  timestamp: string,
  overrides: Partial<LogEntry> = {},
): LogEntry => ({
  id,
  tripId: 'trip',
  legId: 'leg',
  type: 'NOTE',
  timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  synced: true,
  deleted: false,
  ...overrides,
})

it('times the latest trip entry including between-leg entries, ignores deleted/other-trip entries, and opens timeline rows', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-29T10:00:00Z'))
  state.entries = [
    entry('old', '2026-09-29T09:10:00Z'),
    entry('latest', '2026-09-29T09:55:00Z', {
      legId: null,
      notes: 'At anchor',
    }),
    entry('deleted', '2026-09-29T09:59:00Z', { deleted: true }),
    entry('other', '2026-09-29T09:59:30Z', { tripId: 'other' }),
  ]
  const onOpenEntry = vi.fn()
  const props = {
    tripId: 'trip',
    tripStatus: 'IN_PROGRESS' as const,
    mediaByEntry: new Map(),
    onOpenEntry,
  }
  const { rerender } = render(<TripLegSection {...props} />)
  expect(screen.getByRole('timer').textContent).toContain('05:00')
  expect(screen.queryByText(/\d+ entries/)).toBeNull()
  fireEvent.click(screen.getByText('At anchor'))
  expect(onOpenEntry).toHaveBeenCalledWith('latest')
  state.entries = state.entries.map((item) =>
    item.id === 'latest' ? { ...item, deleted: true } : item,
  )
  rerender(<TripLegSection {...props} />)
  expect(screen.getByRole('timer').textContent).toContain('50:00')
})
