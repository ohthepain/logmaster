// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Trip } from '../domain/logbook'
import { TripActionsMenu } from './TripActionsMenu'

const { logbook, options } = vi.hoisted(() => ({
  logbook: {
    tracks: [],
    entries: [],
    deleteTrip: vi.fn(),
    ensureTripTrackPayloads: vi.fn(),
  },
  options: {
    devMode: false,
    devTripRetrip: null,
    setDevTripRetrip: vi.fn(),
    stopDevTripRetrip: vi.fn(),
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      key === 'tripOptionsFor' ? `Options for ${values?.name}` : key,
  }),
}))
vi.mock('../lib/dev-mode', () => ({ isDevModeAvailable: () => false }))
vi.mock('../stores/logbook', () => ({
  useLogbookStore: Object.assign(
    (selector: (value: typeof logbook) => unknown) => selector(logbook),
    { getState: () => logbook },
  ),
}))
vi.mock('../stores/app-options', () => ({
  useAppOptionsStore: (selector: (value: typeof options) => unknown) =>
    selector(options),
}))

afterEach(() => {
  cleanup()
  logbook.deleteTrip.mockReset()
})

const trip: Trip = {
  id: 'trip-1',
  boatName: 'Kestrel',
  title: 'Weekend reach',
  startedAt: '2026-06-01T08:00:00.000Z',
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-01T08:00:00.000Z',
  status: 'COMPLETED',
}

it('ports the trip menu above the page and deletes from Delete trip', async () => {
  logbook.deleteTrip.mockResolvedValue(undefined)
  render(
    <div className="overflow-hidden">
      <TripActionsMenu trip={trip} entryCount={2} />
    </div>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Options for Weekend reach' }))

  const deleteItem = screen.getByRole('menuitem', { name: 'Delete trip' })
  expect(deleteItem.closest('[role="menu"]')?.parentElement).toBe(document.body)
  expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()

  fireEvent.click(deleteItem)
  fireEvent.click(screen.getByRole('button', { name: 'Delete trip' }))

  expect(logbook.deleteTrip).toHaveBeenCalledWith('trip-1')
})
