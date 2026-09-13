import sharp from 'sharp'
import { normalizeAssetPhoto } from './asset-intelligence'

export async function prepareOriginalAssetPhoto(file: File) {
  const preview = await normalizeAssetPhoto(file)
  const original = Buffer.from(await file.arrayBuffer())
  const metadata = await sharp(original, {
    limitInputPixels: 50_000_000,
  }).metadata()
  const formats: Record<string, [string, string]> = {
    jpeg: ['image/jpeg', 'jpg'],
    png: ['image/png', 'png'],
    webp: ['image/webp', 'webp'],
    heif: ['image/heif', 'heif'],
    gif: ['image/gif', 'gif'],
    tiff: ['image/tiff', 'tiff'],
  }
  const format = formats[metadata.format ?? '']
  if (!format) throw new Error('Unsupported photo format.')
  return { original, preview, mimeType: format[0], extension: format[1] }
}
