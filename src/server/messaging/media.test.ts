import { beforeEach, expect, it, vi } from 'vitest'
import { S3Client } from '@aws-sdk/client-s3'
import {
  completeMessageMedia,
  getSharedMessageMedia,
  messageMediaKey,
  prepareMessageMedia,
  requireMessageAttachments,
  requireLogbookAttachments,
} from './media'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  many: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
}))
vi.mock('../db', () => ({
  prisma: {
    chatMedia: {
      findFirst: mocks.find,
      findMany: mocks.many,
      upsert: mocks.upsert,
      update: mocks.update,
    },
  },
}))
vi.mock('../s3-photos', () => ({
  getPhotosS3Client: () => {
    const client = new S3Client({
      region: 'eu-central-1',
      credentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' },
    })
    client.send = mocks.send
    return client
  },
}))
const input = {
  checksum: 'a'.repeat(64),
  size: 123,
  contentType: 'image/jpeg',
  fileName: 'boat.jpg',
}
const media = { id: 'media', uploaderId: 'user', uploadedAt: null, ...input }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.upsert.mockResolvedValue(media)
  mocks.find.mockResolvedValue(media)
  mocks.send.mockResolvedValue({
    ContentLength: 123,
    ContentType: 'image/jpeg',
    ChecksumSHA256: Buffer.from(input.checksum, 'hex').toString('base64'),
  })
})
it('reuses only owned or already shared, verified content', async () => {
  mocks.find.mockResolvedValue({ ...media, uploadedAt: new Date() })
  expect((await prepareMessageMedia('user', 'boat:b', input)).upload).toBeNull()
  expect(mocks.upsert).not.toHaveBeenCalled()
  expect(mocks.send).not.toHaveBeenCalled()
  expect(mocks.find).toHaveBeenCalledWith({
    where: {
      checksum: input.checksum,
      uploadedAt: { not: null },
      OR: [
        { uploaderId: 'user' },
        { messages: { some: { message: { threadId: 'boat:b' } } } },
      ],
    },
  })
})
it('signs exact byte length, checksum, MIME type and overwrite protection without exposing a secret', async () => {
  mocks.find.mockResolvedValueOnce(null)
  mocks.send.mockRejectedValueOnce(
    Object.assign(new Error('not found'), { name: 'NotFound' }),
  )
  const result = await prepareMessageMedia('user', 'boat:b', input)
  const url = new URL(result.upload!.url)
  const signed = url.searchParams.get('X-Amz-SignedHeaders')!.split(';')
  expect(signed).toEqual(
    expect.arrayContaining([
      'content-length',
      'content-type',
      'if-none-match',
      'x-amz-checksum-sha256',
    ]),
  )
  expect(result.upload!.headers['If-None-Match']).toBe('*')
  expect(JSON.stringify(result)).not.toContain('test-secret')
  expect(messageMediaKey('other', input.checksum)).not.toBe(
    messageMediaKey('user', input.checksum),
  )
})
it('recovers an interrupted completion without another upload', async () => {
  mocks.find.mockResolvedValueOnce(null)
  expect((await prepareMessageMedia('user', 'boat:b', input)).upload).toBeNull()
  expect(mocks.update).toHaveBeenCalledWith({
    where: { id: 'media' },
    data: { uploadedAt: expect.any(Date) },
  })
})
it.each([
  'ContentLength',
  'ContentType',
  'ChecksumSHA256',
])('rejects a wrong %s before marking an upload complete', async (field) => {
  mocks.send.mockResolvedValue({
    ContentLength: 123,
    ContentType: 'image/jpeg',
    ChecksumSHA256: Buffer.from(input.checksum, 'hex').toString('base64'),
    [field]: 'wrong',
  })
  await expect(completeMessageMedia('user', 'media')).rejects.toThrow(
    'verification failed',
  )
  expect(mocks.update).not.toHaveBeenCalled()
})
it('does not attach unverified or unrelated media and never reads unshared drafts', async () => {
  mocks.many.mockResolvedValue([])
  await expect(
    requireMessageAttachments('user', 'boat:b', ['private']),
  ).rejects.toThrow('not uploaded or available')
  mocks.find.mockResolvedValue(null)
  await expect(getSharedMessageMedia('boat:b', 'private')).rejects.toThrow(
    'Media not found',
  )
  expect(mocks.find).toHaveBeenLastCalledWith({
    where: {
      id: 'private',
      uploadedAt: { not: null },
      OR: [{ messages: { some: { message: { threadId: 'boat:b' } } } }],
    },
  })
})

it('allows logbook editors to reuse log media without exposing private chat attachments', async () => {
  mocks.many.mockResolvedValue([{ id: 'shared-log' }])
  await requireLogbookAttachments('editor', 'trip', ['shared-log'])
  expect(mocks.many).toHaveBeenCalledWith({
    where: {
      id: { in: ['shared-log'] },
      uploadedAt: { not: null },
      OR: [
        { uploaderId: 'editor' },
        {
          logMedia: {
            some: {
              logEntry: {
                tripId: 'trip',
                deleted: false,
                economyHidden: false,
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  })
  mocks.many.mockResolvedValue([])
  await expect(
    requireLogbookAttachments('editor', 'trip', ['private-chat']),
  ).rejects.toThrow('not uploaded or available')
})
