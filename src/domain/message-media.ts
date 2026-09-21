export const MAX_MESSAGE_MEDIA_BYTES = 100 * 1024 * 1024
export const MAX_MESSAGE_ATTACHMENTS = 10
export const MESSAGE_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/ogg',
  'video/3gpp',
] as const
export const LOG_MEDIA_TYPES = [
  ...MESSAGE_MEDIA_TYPES,
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
  'audio/aac',
] as const
export type ChatAttachment = {
  id: string
  checksum: string
  contentType: string
  size: number
  fileName: string
}
export function messageMediaType(file: Pick<File, 'type' | 'name'>): string {
  const aliases: Record<string, string> = {
    'image/jpg': 'image/jpeg',
    'video/mov': 'video/quicktime',
  }
  if (file.type)
    return aliases[file.type] ?? file.type.split(';')[0].toLowerCase()
  const extensions: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    heic: 'image/heic',
    heif: 'image/heif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    ogv: 'video/ogg',
    '3gp': 'video/3gpp',
  }
  return extensions[file.name.split('.').at(-1)?.toLowerCase() ?? ''] ?? ''
}
export function validateMessageFile(file: File, allowAudio = false) {
  if (
    !(allowAudio ? LOG_MEDIA_TYPES : MESSAGE_MEDIA_TYPES).some(
      (type) => type === messageMediaType(file),
    )
  )
    throw new Error(`${file.name}: choose a supported photo or video.`)
  if (!file.size || file.size > MAX_MESSAGE_MEDIA_BYTES)
    throw new Error(`${file.name}: files must be between 1 byte and 100 MB.`)
}
