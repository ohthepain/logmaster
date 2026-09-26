import type { MediaResult } from '@capacitor/camera'

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

export async function fileFromCameraMediaResult(
  result: MediaResult,
  fileName = 'equipment-photo',
): Promise<File | null> {
  if (!result.webPath) return null
  const blob = await (await fetch(result.webPath)).blob()
  const format = result.metadata?.format ?? 'jpeg'
  const ext = format === 'jpeg' ? 'jpg' : format
  return new File([blob], `${fileName}.${ext}`, {
    type: blob.type || 'image/jpeg',
  })
}
