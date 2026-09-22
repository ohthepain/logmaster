import sharp from 'sharp'
import {
  cropToPixelRect,
  parseProfilePhotoCrop,
} from '../lib/profile-photo-crop'
import type { ProfilePhotoCrop } from '../lib/profile-photo-crop'

export { parseProfilePhotoCrop, type ProfilePhotoCrop }

export async function renderProfilePhotoBytes(
  bytes: Buffer,
  crop: ProfilePhotoCrop | null | undefined,
  contentType?: string | null,
): Promise<{ buffer: Buffer; contentType: string }> {
  const input = sharp(bytes, { limitInputPixels: 50_000_000 })
  const metadata = await input.metadata()
  const width = metadata.width
  const height = metadata.height
  if (!width || !height) {
    return {
      buffer: bytes,
      contentType: contentType || 'image/jpeg',
    }
  }

  if (!crop) {
    return {
      buffer: bytes,
      contentType:
        contentType || mimeFromFormat(metadata.format) || 'image/jpeg',
    }
  }

  const {
    left,
    top,
    width: cropWidth,
    height: cropHeight,
  } = cropToPixelRect(crop, width, height)

  const buffer = await sharp(bytes, { limitInputPixels: 50_000_000 })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .jpeg({ quality: 90 })
    .toBuffer()

  return { buffer, contentType: 'image/jpeg' }
}

function mimeFromFormat(format: string | undefined) {
  switch (format) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'heif':
    case 'heic':
      return 'image/heic'
    default:
      return null
  }
}
