// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AppShell } from './AppShell'
import { isNativeAppleMapUnderlayRoute } from '../lib/trip-map-overlay'

const testState = vi.hoisted(() => ({
  route: {
    location: { pathname: '/map', search: {} },
    matches: [] as { routeId: string; params: { tripId: string } }[],
  },
  navigate: vi.fn(),
  mounts: vi.fn(),
  unmounts: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (state: typeof testState.route) => unknown
  }) => select(testState.route),
  useNavigate: () => testState.navigate,
}))
vi.mock('./Header', () => ({
  default: ({ onClose }: { onClose?: () => void }) => (
    <header>
      {onClose ? (
        <button onClick={onClose}>Close boats</button>
      ) : (
        <button>Menu</button>
      )}
    </header>
  ),
}))
vi.mock('./AuthGate', () => ({
  AuthGate: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./FtueGate', () => ({
  FtueGate: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./BackgroundTripRecorder', () => ({
  BackgroundTripRecorder: () => null,
}))
vi.mock('./LiveActivityController', () => ({
  LiveActivityController: () => null,
}))
vi.mock('./DevComponentLabel', () => ({ DevComponentLabel: () => null }))
vi.mock('./DevTripReplayController', () => ({
  DevTripReplayController: () => null,
}))
vi.mock('./DevTripRetripController', () => ({
  DevTripRetripController: () => null,
}))
vi.mock('./IosBlockingOverlayTouchBridge', () => ({
  IosBlockingOverlayTouchBridge: () => null,
}))
vi.mock('../lib/native/ios-map-touch-passthrough', () => ({
  useIosNativeMapTouchPassthrough: vi.fn(),
}))
vi.mock('../lib/native/ios-map-touch-suspend', () => ({
  requestIosMapTouchSync: vi.fn(),
}))
vi.mock('../lib/platform', () => ({ getNativePlatform: () => 'web' }))
vi.mock('../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../stores/logbook', () => ({
  useLogbookStore: { getState: () => ({ setOnline: vi.fn() }) },
}))
vi.mock('./MapDefaultView', () => ({
  MapDefaultView: ({ active }: { active: boolean }) => (
    <div data-testid="default-map" data-active={active} />
  ),
}))
vi.mock('./TripDetailPage', async () => {
  const { useState, useEffect } = await import('react')
  return {
    TripDetailPage: ({ tripId }: { tripId: string }) => {
      const [zoom, setZoom] = useState('10')
      useEffect(() => {
        testState.mounts()
        return () => {
          testState.unmounts()
        }
      }, [])
      return (
        <input
          aria-label="Map zoom"
          data-trip={tripId}
          value={zoom}
          onChange={(event) => setZoom(event.target.value)}
        />
      )
    },
  }
})
function route(pathname: string, tripId?: string) {
  testState.route = {
    location: { pathname, search: {} },
    matches: tripId
      ? [{ routeId: '/_main/trips/$tripId/', params: { tripId } }]
      : [],
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('preserves the actual map instance and viewport across the boat list, tabs, and close', async () => {
  route('/trips/voyage', 'voyage')
  const { rerender } = render(<AppShell>Route content</AppShell>)
  const map = await screen.findByLabelText('Map zoom')
  fireEvent.change(map, { target: { value: '17' } })
  route('/boats')
  rerender(<AppShell>Boat list</AppShell>)
  const dialog = screen.getByRole('dialog')
  dialog.scrollTop = 120
  expect(dialog.textContent).toContain('Boat list')
  expect(map.closest('[inert]')).not.toBeNull()
  expect(document.body.style.overflow).toBe('hidden')
  route('/boats/cajolo')
  rerender(<AppShell>Members</AppShell>)
  expect(screen.getByRole('dialog')).toBe(dialog)
  expect(dialog.scrollTop).toBe(120)
  expect(testState.mounts).toHaveBeenCalledOnce()
  expect(testState.unmounts).not.toHaveBeenCalled()
  expect((map as HTMLInputElement).value).toBe('17')
  fireEvent.click(screen.getByRole('button', { name: 'Close boats' }))
  expect(testState.navigate).toHaveBeenCalledWith({
    to: '/trips/$tripId',
    params: { tripId: 'voyage' },
  })
  route('/trips/voyage', 'voyage')
  rerender(<AppShell>Route content</AppShell>)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByLabelText('Map zoom')).toBe(map)
  expect(document.body.style.overflow).toBe('')
  expect(map.closest('[inert]')).toBeNull()
})

it('shows a map beneath direct boat links and closes to the map', async () => {
  route('/boats/cajolo')
  render(<AppShell>Boat</AppShell>)
  expect(
    (await screen.findByTestId('default-map')).getAttribute('data-active'),
  ).toBe('false')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(testState.navigate).toHaveBeenCalledWith({ to: '/map' })
})

it('keeps nested dialog Escape separate from closing the boat panel', () => {
  route('/boats')
  render(
    <AppShell>
      <div role="dialog" aria-modal="true">
        Invite
      </div>
    </AppShell>,
  )
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(testState.navigate).not.toHaveBeenCalled()
})

it('releases the map when leaving the boat flow for a different page', async () => {
  route('/trips/voyage', 'voyage')
  const { rerender } = render(<AppShell>Trip</AppShell>)
  await screen.findByLabelText('Map zoom')
  route('/boats')
  rerender(<AppShell>Boats</AppShell>)
  route('/orgs')
  rerender(<AppShell>Organisations</AppShell>)
  expect(testState.unmounts).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByText('Organisations')).toBeTruthy()
})

it('keeps the native map underlay through boat subpages but excludes non-map trip pages', () => {
  for (const path of [
    '/boats',
    '/boats/',
    '/boats/cajolo',
    '/boats/cajolo/contacts/alex',
    '/trips/voyage/',
  ])
    expect(isNativeAppleMapUnderlayRoute(path)).toBe(true)
  for (const path of ['/orgs', '/trips/voyage/story', '/boats-other'])
    expect(isNativeAppleMapUnderlayRoute(path)).toBe(false)
})
