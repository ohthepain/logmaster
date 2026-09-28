// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type * as CameraMediaFile from '../lib/camera-media-file'
import { I18nProvider } from '../lib/i18n'
import { EquipmentPhotoPickerSheet } from './EquipmentPhotoPickerSheet'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  load: vi.fn(),
  supports: vi.fn(),
  pick: vi.fn(),
}))
vi.mock('../lib/native/logmaster-recent-photos', () => ({
  supportsRecentPhotoPickerSheet: mocks.supports,
  listRecentPhotoThumbnails: mocks.list,
  loadRecentPhotoFile: mocks.load,
}))
vi.mock('../lib/camera-media-file', async (importOriginal) => ({
  ...(await importOriginal<typeof CameraMediaFile>()),
  pickEquipmentPhoto: mocks.pick,
}))
const onPick = vi.fn(),
  onClose = vi.fn()
const photo = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
const mount = () =>
  render(
    <I18nProvider>
      <EquipmentPhotoPickerSheet open onPick={onPick} onClose={onClose} />
    </I18nProvider>,
  )
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  mocks.supports.mockReturnValue(true)
  mocks.list.mockResolvedValue([
    { localIdentifier: 'newest', thumbnailBase64: btoa('newest') },
    { localIdentifier: 'older', thumbnailBase64: btoa('older') },
  ])
  mocks.load.mockResolvedValue({ base64: btoa('photo'), format: 'jpeg' })
  mocks.pick.mockResolvedValue(photo)
})
afterEach(cleanup)
it('keeps camera first while loading, then preserves newest-first thumbnail order', async () => {
  let resolve!: (photos: unknown[]) => void
  mocks.list.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  mount()
  const camera = screen.getByRole('button', { name: 'Take photo' })
  expect(camera.parentElement?.firstElementChild).toBe(camera)
  expect((camera as HTMLButtonElement).disabled).toBe(false)
  await act(async () =>
    resolve([
      { localIdentifier: 'newest', thumbnailBase64: btoa('newest') },
      { localIdentifier: 'older', thumbnailBase64: btoa('older') },
    ]),
  )
  const gridButtons = within(camera.parentElement!).getAllByRole('button')
  expect(gridButtons[0]).toBe(camera)
  fireEvent.click(gridButtons[1])
  await waitFor(() => expect(onPick).toHaveBeenCalled())
  expect(mocks.load).toHaveBeenCalledWith('newest')
  expect(onPick.mock.calls[0][0].size).toBe(5)
})
it('keeps camera and system library picker usable when library permission fails', async () => {
  mocks.list.mockRejectedValue(new Error('Photo library access denied'))
  mount()
  await screen.findByText(/Recent photos could not be loaded/)
  fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
  await waitFor(() => expect(onPick).toHaveBeenCalledWith(photo))
  expect(mocks.pick).toHaveBeenCalledWith('CAMERA')
  expect(mocks.list).toHaveBeenCalledTimes(1)
})
it('shows photo errors inside the open sheet and allows another selection', async () => {
  mocks.load.mockRejectedValueOnce(new Error('Cloud photo download failed'))
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Recent photo 1' }))
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Could not load this photo',
  )
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Recent photo 2' }))
  await waitFor(() => expect(onPick).toHaveBeenCalled())
  expect(mocks.list).toHaveBeenCalledTimes(1)
})
it('treats cancelling the camera as a no-op', async () => {
  mocks.pick.mockRejectedValue(new Error('User cancelled photos app'))
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
  await waitFor(() => {
    const button = screen.getByRole('button', { name: 'Take photo' })
    expect(button).toBeInstanceOf(HTMLButtonElement)
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })
  expect(screen.queryByRole('alert')).toBeNull()
  expect(onClose).not.toHaveBeenCalled()
})
it('opens at half height, resizes by pointer and keyboard, and resets when reopened', () => {
  mocks.supports.mockReturnValue(false)
  const view = mount()
  const slider = screen.getByRole('slider')
  const dialog = screen.getByRole('dialog')
  expect(dialog.style.height).toBe('50dvh')
  slider.setPointerCapture = vi.fn()
  slider.releasePointerCapture = vi.fn()
  // jsdom has no PointerEvent implementation; preserve pointer coordinates.
  const pointer = (type: string, y: number) => {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, { clientY: y, pointerId: 1 })
    fireEvent(slider, event)
  }
  pointer('pointerdown', 400)
  pointer('pointermove', 200)
  expect(Number.parseFloat(dialog.style.height)).toBeGreaterThan(50)
  pointer('pointermove', 500)
  expect(Number.parseFloat(dialog.style.height)).toBeLessThan(50)
  pointer('pointerup', 500)
  fireEvent.keyDown(slider, { key: 'End' })
  expect(dialog.style.height).toBe('95dvh')
  view.rerender(
    <I18nProvider>
      <EquipmentPhotoPickerSheet
        open={false}
        onPick={onPick}
        onClose={onClose}
      />
    </I18nProvider>,
  )
  view.rerender(
    <I18nProvider>
      <EquipmentPhotoPickerSheet open onPick={onPick} onClose={onClose} />
    </I18nProvider>,
  )
  expect(screen.getByRole('dialog').style.height).toBe('50dvh')
  expect(mocks.list).not.toHaveBeenCalled()
})
