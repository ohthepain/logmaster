import type { BoatDocumentOpenTarget } from './boat-document-open'

export type BoatDocumentViewKind = 'pdf' | 'image' | 'text' | 'embed'

const VIEWABLE_EXTENSIONS = new Set([
  'pdf',
  'txt',
  'csv',
  'md',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
  'doc',
  'docx',
  'xls',
  'xlsx',
])

function extensionFromPath(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value.split('?')[0]?.split('#')[0] ?? value
  const match = cleaned.match(/\.([a-z0-9]{1,8})$/i)
  return match?.[1]?.toLowerCase() ?? null
}

export function extensionForBoatDocumentTarget(
  target: BoatDocumentOpenTarget,
): string {
  const fromName = extensionFromPath(target.fileName)
  if (fromName) return fromName

  const fromUrl = extensionFromPath(target.url)
  if (fromUrl) return fromUrl

  const mime = target.mimeType?.toLowerCase() ?? ''
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'text/plain') return 'txt'
  if (mime === 'text/csv') return 'csv'
  if (mime === 'application/msword') return 'doc'
  if (
    mime ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx'
  }
  if (mime === 'application/vnd.ms-excel') return 'xls'
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'xlsx'
  }
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic'
  if (mime.startsWith('image/')) return 'jpg'

  return 'bin'
}

function viewKindForExtension(ext: string): BoatDocumentViewKind | null {
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) {
    return 'image'
  }
  if (['txt', 'csv', 'md'].includes(ext)) return 'text'
  if (['doc', 'docx', 'xls', 'xlsx'].includes(ext)) return 'embed'
  return null
}

export function getBoatDocumentViewKind(
  target: BoatDocumentOpenTarget,
): BoatDocumentViewKind | null {
  if (target.kind !== 'upload' || !target.contentUrl) return null

  const ext = extensionForBoatDocumentTarget(target)
  if (VIEWABLE_EXTENSIONS.has(ext)) {
    return viewKindForExtension(ext)
  }

  const mime = target.mimeType?.toLowerCase() ?? ''
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('text/')) return 'text'

  return null
}

export function isBoatDocumentViewable(
  target: BoatDocumentOpenTarget,
): boolean {
  return getBoatDocumentViewKind(target) !== null
}

export function cacheFileNameForBoatDocument(
  target: BoatDocumentOpenTarget,
): string {
  const ext = extensionForBoatDocumentTarget(target)
  const baseName = target.fileName?.trim()
  if (baseName && baseName.includes('.')) {
    return `boat-doc-${crypto.randomUUID()}-${baseName.replace(/[^\w.-]+/g, '_')}`
  }
  return `boat-doc-${crypto.randomUUID()}.${ext}`
}
