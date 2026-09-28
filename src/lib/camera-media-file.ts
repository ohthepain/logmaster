import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

export function fileFromBase64Image(
  base64: string,
  format: string,
  fileName = 'equipment-photo',
): File {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const normalized = format.toLowerCase()
  const ext = normalized === 'jpeg' ? 'jpg' : normalized
  const mime =
    normalized === 'png'
      ? 'image/png'
      : normalized === 'gif'
        ? 'image/gif'
        : normalized === 'heic'
          ? 'image/heic'
          : 'image/jpeg'
  return new File([bytes], `${fileName}.${ext}`, { type: mime })
}

// getPhoto is deliberately retained for installed native shells that predate
// takePhoto/chooseFromGallery. Base64 crosses the bridge directly: fetching a
// capacitor:// file URL from our remotely hosted HTTPS app can fail.
export async function pickEquipmentPhoto(source: CameraSource): Promise<File> {
  if (source === CameraSource.Camera && Capacitor.getPlatform() === 'ios') {
    let { camera } = await Camera.checkPermissions()
    if (camera === 'prompt' || camera === 'prompt-with-rationale') {
      const requested = await Camera.requestPermissions({
        permissions: ['camera'],
      })
      camera = requested.camera
    }
    if (camera !== 'granted') throw new Error('Camera permission denied')
  }
  const photo = await Camera.getPhoto({
    source,
    resultType: CameraResultType.Base64,
    quality: 100,
    correctOrientation: true,
    webUseInput: true,
  })
  if (!photo.base64String) throw new Error('No photo data returned')
  return fileFromBase64Image(photo.base64String, photo.format)
}

export function isPhotoSelectionCancelled(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  return (
    code === 'OS-PLUG-CAMR-0006' ||
    code === 'OS-PLUG-CAMR-0020' ||
    /cancel/i.test(String(error))
  )
}
