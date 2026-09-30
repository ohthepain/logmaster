import {
  cropToPixelRect,
  normalizeProfilePhotoCrop,
} from './profile-photo-crop'
import type { ProfilePhotoCrop } from './profile-photo-crop'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read photo'))
    image.src = url
  })
}

/** Square region of a photo, matching the profile photo crop editor. */
export async function cropImageFile(
  sourceUrl: string,
  crop: ProfilePhotoCrop,
  fileName = 'photo.jpg',
): Promise<File> {
  const image = await loadImage(sourceUrl)
  const normalized = normalizeProfilePhotoCrop(
    crop,
    image.naturalWidth,
    image.naturalHeight,
  )
  const { left, top, width, height } = cropToPixelRect(
    normalized,
    image.naturalWidth,
    image.naturalHeight,
  )
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not crop photo')
  context.drawImage(image, left, top, width, height, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result)
        else reject(new Error('Could not crop photo'))
      },
      'image/jpeg',
      0.92,
    )
  })

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'photo'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
}
