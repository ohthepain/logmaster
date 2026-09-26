// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MapDefaultView } from './MapDefaultView'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  load: vi.fn(),
  selectTrip: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../lib/auth-client', () => ({
  useSession: () => ({ data: { user: { id: 'user' } } }),
}))
vi.mock('./TripLogMap', () => ({
  TripLogMap: () => <div data-testid="map-canvas" />,
}))
vi.mock('./StartTripLauncher', () => ({ StartTripLauncher: () => null }))
vi.mock('./DevComponentLabel', () => ({ DevComponentLabel: () => null }))
vi.mock('../stores/logbook', () => ({
  useLogbookStore: Object.assign(
    () => ({
      booted: true,
      trips: [{ id: 'active-voyage', status: 'IN_PROGRESS' }],
    }),
    { getState: () => ({ load: mocks.load, selectTrip: mocks.selectTrip }) },
  ),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('never redirects away from a directly opened boat panel when an active trip exists', () => {
  const { rerender } = render(<MapDefaultView active={false} />)
  expect(screen.getByTestId('map-canvas')).toBeTruthy()
  expect(mocks.navigate).not.toHaveBeenCalled()
  rerender(<MapDefaultView active />)
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: '/trips/$tripId',
    params: { tripId: 'active-voyage' },
    replace: true,
  })
})
