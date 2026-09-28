// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { CameraSource } from '@capacitor/camera'
import {
  isPhotoSelectionCancelled,
  pickEquipmentPhoto,
} from './camera-media-file'

const mocks = vi.hoisted(() => ({
  getPhoto: vi.fn(),
  check: vi.fn(),
  request: vi.fn(),
  platform: vi.fn(),
}))
vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: mocks.getPhoto,
    checkPermissions: mocks.check,
    requestPermissions: mocks.request,
  },
  CameraSource: { Camera: 'CAMERA', Photos: 'PHOTOS' },
  CameraResultType: { Base64: 'base64' },
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: mocks.platform },
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.platform.mockReturnValue('ios')
  mocks.check.mockResolvedValue({ camera: 'prompt' })
  mocks.request.mockResolvedValue({ camera: 'granted' })
  mocks.getPhoto.mockResolvedValue({
    base64String: btoa('image data'),
    format: 'jpeg',
  })
})
it('requests only camera permission before capture, returning a real image file', async () => {
  const file = await pickEquipmentPhoto(CameraSource.Camera)
  expect(mocks.request).toHaveBeenCalledWith({ permissions: ['camera'] })
  expect(mocks.request.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.getPhoto.mock.invocationCallOrder[0],
  )
  expect(mocks.getPhoto).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'CAMERA', resultType: 'base64' }),
  )
  expect(file.name).toBe('equipment-photo.jpg')
  expect(file.type).toBe('image/jpeg')
  expect(file.size).toBe(10)
})
it('does not ask again when camera permission is granted', async () => {
  mocks.check.mockResolvedValue({ camera: 'granted' })
  await pickEquipmentPhoto(CameraSource.Camera)
  expect(mocks.request).not.toHaveBeenCalled()
})
it.each([
  'denied',
  'prompt',
])('does not open the camera when permission stays %s', async (permission) => {
  mocks.check.mockResolvedValue({ camera: permission })
  mocks.request.mockResolvedValue({ camera: 'denied' })
  await expect(pickEquipmentPhoto(CameraSource.Camera)).rejects.toThrow(
    'Camera permission denied',
  )
  expect(mocks.getPhoto).not.toHaveBeenCalled()
})
it('selects a library image independently of camera access', async () => {
  mocks.check.mockResolvedValue({ camera: 'denied' })
  const file = await pickEquipmentPhoto(CameraSource.Photos)
  expect(file.size).toBe(10)
  expect(mocks.check).not.toHaveBeenCalled()
  expect(mocks.request).not.toHaveBeenCalled()
})
it('rejects an empty result instead of silently dropping the photo', async () => {
  mocks.getPhoto.mockResolvedValue({ format: 'jpeg' })
  await expect(pickEquipmentPhoto(CameraSource.Photos)).rejects.toThrow(
    'No photo data',
  )
})
it('recognizes native and browser cancellation but not permissions failures', () => {
  expect(isPhotoSelectionCancelled({ code: 'OS-PLUG-CAMR-0020' })).toBe(true)
  expect(
    isPhotoSelectionCancelled(new Error('User cancelled photos app')),
  ).toBe(true)
  expect(isPhotoSelectionCancelled(new Error('Permission denied'))).toBe(false)
})
