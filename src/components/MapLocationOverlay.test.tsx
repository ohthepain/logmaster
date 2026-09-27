// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MapLocationOverlay } from './MapLocationOverlay'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))
vi.mock('../lib/native/background-tracker', () => ({
  openBackgroundLocationSettings: vi.fn(),
}))
vi.mock('../lib/native/ios-map-touch-suspend', () => ({
  requestIosMapTouchSync: vi.fn(),
}))

afterEach(cleanup)

it('lets the user skip while a position fix is still pending', () => {
  const onBrowse = vi.fn()
  const { container } = render(
    <MapLocationOverlay
      state="locating"
      onContinue={() => {}}
      onBrowse={onBrowse}
    />,
  )
  expect(
    screen.getByRole('heading', { name: 'Getting your location…' }),
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Browse map' })).toBeNull()
  expect(container.firstElementChild?.className).toContain('bg-[#102f3c]/15')
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
  expect(onBrowse).toHaveBeenCalledOnce()
})

it('keeps the failure actions after the fix gives up', () => {
  render(
    <MapLocationOverlay
      state="timeout"
      onContinue={() => {}}
      onBrowse={() => {}}
    />,
  )
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Browse map' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
})
