import { createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getPhotosS3Client } from '../s3-photos'
import { requireThread } from './threads'

/** Storage boundary for v2 attachments. Do not use Stream upload APIs or public ACLs. */
export const messageMediaBucket = () =>
  process.env.S3_BUCKET_MESSAGE_MEDIA?.trim() || 'logmaster-message-media'
const MAX_BYTES = 20 * 1024 * 1024
const TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'audio/mp4',
  'audio/mpeg',
  'application/pdf',
])
function mediaKey(threadId: string, mediaId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) throw new Error('Invalid media ID')
  // Hashes avoid coupling S3 paths to provider channel IDs and unsafe object names.
  return `threads/${createHash('sha256').update(threadId).digest('hex')}/${mediaId}`
}
export async function storeMessageMedia(input: {
  userId: string
  threadId: string
  mediaId: string
  body: Uint8Array
  contentType: string
}) {
  await requireThread(input.userId, input.threadId)
  if (
    !TYPES.has(input.contentType) ||
    !input.body.byteLength ||
    input.body.byteLength > MAX_BYTES
  )
    throw new Error('Unsupported media or file larger than 20 MB')
  const key = mediaKey(input.threadId, input.mediaId)
  await getPhotosS3Client().send(
    new PutObjectCommand({
      Bucket: messageMediaBucket(),
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
      ServerSideEncryption: 'AES256',
      CacheControl: 'private, no-store',
    }),
  )
  return { key, contentType: input.contentType, size: input.body.byteLength }
}
export async function readMessageMedia(
  userId: string,
  threadId: string,
  mediaId: string,
) {
  await requireThread(userId, threadId)
  return getPhotosS3Client().send(
    new GetObjectCommand({
      Bucket: messageMediaBucket(),
      Key: mediaKey(threadId, mediaId),
    }),
  )
}
