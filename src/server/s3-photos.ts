import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

let client: S3Client | null = null

export function getPhotosS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION ?? 'eu-central-1',
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    })
  }
  return client
}

export function photosBucket(): string {
  const bucket = process.env.S3_BUCKET_PHOTOS?.trim()
  if (!bucket) {
    throw new Error('Set S3_BUCKET_PHOTOS in .env')
  }
  return bucket
}

export async function uploadPhotoObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<void> {
  await getPhotosS3Client().send(
    new PutObjectCommand({
      Bucket: photosBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
}

export async function deletePhotoObject(key: string): Promise<void> {
  await getPhotosS3Client().send(
    new DeleteObjectCommand({
      Bucket: photosBucket(),
      Key: key,
    }),
  )
}

export async function getPhotoObject(key: string) {
  return getPhotosS3Client().send(
    new GetObjectCommand({
      Bucket: photosBucket(),
      Key: key,
    }),
  )
}

export function photoS3Key(
  userId: string,
  boatId: string,
  photoId: string,
  ext: string,
): string {
  return `users/${userId}/boats/${boatId}/${photoId}.${ext}`
}

export function profilePhotoS3Key(userId: string, ext: string): string {
  return `users/${userId}/profile/avatar.${ext}`
}

export function crewMemberPhotoS3Key(
  ownerUserId: string,
  crewMemberId: string,
  ext: string,
): string {
  return `users/${ownerUserId}/crew/${crewMemberId}.${ext}`
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return 'heic'
  return 'jpg'
}

export function storyMediaS3Key(
  userId: string,
  tripId: string,
  mediaId: string,
  ext: string,
): string {
  return `users/${userId}/stories/${tripId}/${mediaId}.${ext}`
}

export function extensionForStoryMime(mimeType: string): string {
  if (mimeType.startsWith('video/')) {
    if (mimeType === 'video/webm') return 'webm'
    if (mimeType === 'video/quicktime') return 'mov'
    return 'mp4'
  }
  return extensionForMime(mimeType)
}

export function boatDocumentS3Key(
  userId: string,
  boatId: string,
  documentId: string,
  versionId: string,
  ext: string,
): string {
  return `users/${userId}/boats/${boatId}/documents/${documentId}/${versionId}.${ext}`
}

export function consortiumPhotoS3Key(
  userId: string,
  consortiumId: string,
  photoId: string,
  ext: string,
): string {
  return `users/${userId}/consortia/${consortiumId}/${photoId}.${ext}`
}

export function consortiumDocumentS3Key(
  userId: string,
  consortiumId: string,
  documentId: string,
  versionId: string,
  ext: string,
): string {
  return `users/${userId}/consortia/${consortiumId}/documents/${documentId}/${versionId}.${ext}`
}

export function extensionForDocumentMime(
  mimeType: string,
  fileName?: string,
): string {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'text/plain') return 'txt'
  if (mimeType === 'text/csv') return 'csv'
  if (mimeType === 'application/msword') return 'doc'
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx'
  }
  if (mimeType === 'application/vnd.ms-excel') return 'xls'
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'xlsx'
  }
  if (mimeType.startsWith('image/')) return extensionForMime(mimeType)
  if (fileName?.includes('.')) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext && ext.length <= 8) return ext
  }
  return 'bin'
}

const DOCUMENT_EXT_CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export function contentTypeForStoredDocument(
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
  fallback?: string | null,
): string {
  const mime = mimeType?.trim()
  if (mime && mime !== 'application/octet-stream') return mime
  if (fallback && fallback !== 'application/octet-stream') return fallback
  const ext = extensionForDocumentMime(mime ?? '', fileName ?? undefined)
  return DOCUMENT_EXT_CONTENT_TYPES[ext] ?? mime ?? fallback ?? 'application/octet-stream'
}

export function inlineContentDisposition(fileName: string): string {
  const safe = fileName.replace(/["\r\n]/g, '').trim() || 'document'
  const ascii = [...safe]
    .map((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code <= 126 ? char : '_'
    })
    .join('')
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`
}
