import { createHash } from 'node:crypto'
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../db'
import { getPhotosS3Client } from '../s3-photos'
import type { ChatAttachment } from '../../domain/message-media'

export const messageMediaBucket = () =>
  process.env.S3_BUCKET_MESSAGE_MEDIA?.trim() || 'logmaster-message-media'
export function messageMediaKey(uploaderId: string, checksum: string) {
  return `users/${createHash('sha256').update(uploaderId).digest('hex')}/sha256/${checksum}`
}
export const mediaDescriptor = (media: ChatAttachment): ChatAttachment => ({
  id: media.id,
  checksum: media.checksum,
  contentType: media.contentType,
  size: media.size,
  fileName: media.fileName,
})
const accessibleMedia = (userId: string, threadId: string) => ({
  uploadedAt: { not: null },
  OR: [
    { uploaderId: userId },
    { messages: { some: { message: { threadId } } } },
  ],
})

// Callers must first authorize current thread membership. Reuse only verified,
// owned or already-shared bytes; a checksum is never an authorization credential.
export async function prepareMessageMedia(
  userId: string,
  threadId: string,
  input: {
    checksum: string
    size: number
    contentType: string
    fileName: string
  },
) {
  const existing = await prisma.chatMedia.findFirst({
    where: { checksum: input.checksum, ...accessibleMedia(userId, threadId) },
  })
  if (existing) return { media: mediaDescriptor(existing), upload: null }
  const media = await prisma.chatMedia.upsert({
    where: {
      uploaderId_checksum: { uploaderId: userId, checksum: input.checksum },
    },
    create: { uploaderId: userId, ...input },
    update: {},
  })
  if (media.size !== input.size || media.contentType !== input.contentType)
    throw new HTTPException(409, {
      message: 'This file has different metadata. Please select it again.',
    })
  // Recover a successful PUT whose completion response was lost, without uploading again.
  try {
    return { media: await completeMessageMedia(userId, media.id), upload: null }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !['NotFound', 'NoSuchKey'].includes(error.name)
    )
      throw error
  }
  const checksum = Buffer.from(media.checksum, 'hex').toString('base64')
  const headers = {
    'Content-Type': media.contentType,
    'x-amz-checksum-sha256': checksum,
    'x-amz-server-side-encryption': 'AES256',
    'If-None-Match': '*',
  }
  const url = await getSignedUrl(
    getPhotosS3Client(),
    new PutObjectCommand({
      Bucket: messageMediaBucket(),
      Key: messageMediaKey(media.uploaderId, media.checksum),
      ContentType: media.contentType,
      ContentLength: media.size,
      ChecksumSHA256: checksum,
      ServerSideEncryption: 'AES256',
      IfNoneMatch: '*',
    }),
    {
      expiresIn: 600,
      unhoistableHeaders: new Set([
        'x-amz-checksum-sha256',
        'x-amz-server-side-encryption',
      ]),
      signableHeaders: new Set([
        'content-type',
        'content-length',
        'if-none-match',
      ]),
    },
  )
  return { media: mediaDescriptor(media), upload: { url, headers } }
}

export async function completeMessageMedia(userId: string, mediaId: string) {
  const media = await prisma.chatMedia.findFirst({
    where: { id: mediaId, uploaderId: userId },
  })
  if (!media) throw new HTTPException(404, { message: 'Media not found' })
  if (!media.uploadedAt) {
    const head = await getPhotosS3Client().send(
      new HeadObjectCommand({
        Bucket: messageMediaBucket(),
        Key: messageMediaKey(media.uploaderId, media.checksum),
        ChecksumMode: 'ENABLED',
      }),
    )
    if (
      head.ContentLength !== media.size ||
      head.ContentType !== media.contentType ||
      head.ChecksumSHA256 !==
        Buffer.from(media.checksum, 'hex').toString('base64')
    )
      throw new HTTPException(409, {
        message: 'Upload verification failed. Please try again.',
      })
    await prisma.chatMedia.update({
      where: { id: media.id },
      data: { uploadedAt: new Date() },
    })
  }
  return mediaDescriptor(media)
}

export async function requireMessageAttachments(
  userId: string,
  threadId: string,
  ids: string[],
) {
  if (!ids.length) return
  const media = await prisma.chatMedia.findMany({
    where: { id: { in: ids }, ...accessibleMedia(userId, threadId) },
    select: { id: true },
  })
  if (media.length !== ids.length)
    throw new HTTPException(400, {
      message:
        'Some attachments are not uploaded or available in this conversation.',
    })
}

export async function getSharedMessageMedia(threadId: string, mediaId: string) {
  const media = await prisma.chatMedia.findFirst({
    where: {
      id: mediaId,
      uploadedAt: { not: null },
      messages: { some: { message: { threadId } } },
    },
  })
  if (!media) throw new HTTPException(404, { message: 'Media not found' })
  return media
}
export async function readMessageMedia(
  media: { uploaderId: string; checksum: string },
  range?: string,
) {
  return getPhotosS3Client().send(
    new GetObjectCommand({
      Bucket: messageMediaBucket(),
      Key: messageMediaKey(media.uploaderId, media.checksum),
      ...(range ? { Range: range } : {}),
    }),
  )
}
