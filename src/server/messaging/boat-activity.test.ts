import type * as PhotoStorage from '../s3-photos'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  boatActivityContent,
  boatActivityMessageContent,
  previewKind,
} from './boat-activity'

const mocks = vi.hoisted(() => ({
  activities: vi.fn(),
  activity: vi.fn(),
  photos: vi.fn(),
  versions: vi.fn(),
  send: vi.fn(),
}))
vi.mock('../db', () => ({
  prisma: {
    boatActivity: { findMany: mocks.activities, findFirst: mocks.activity },
    boatPhoto: { findMany: mocks.photos },
    boatDocumentVersion: { findMany: mocks.versions },
  },
}))
vi.mock('../s3-photos', async (importOriginal) => ({
  ...(await importOriginal<typeof PhotoStorage>()),
  getPhotosS3Client: () => ({ send: mocks.send }),
  photosBucket: () => 'test',
}))
const activity = {
  id: 'event',
  boatId: 'boat',
  kind: 'DOCUMENT_ADDED',
  label: 'Manual',
  targetLabel: null,
  resourceType: 'boat_document',
  resourceId: 'doc',
  versionId: 'v1',
}
const version = {
  id: 'v1',
  documentId: 'doc',
  document: { boatId: 'boat', title: 'Manual' },
  kind: 'upload',
  s3Key: 'private-key',
  mimeType: 'application/pdf',
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.activities.mockResolvedValue([activity])
  mocks.activity.mockResolvedValue(activity)
  mocks.photos.mockResolvedValue([])
  mocks.versions.mockResolvedValue([version])
  mocks.send.mockResolvedValue({
    Body: {
      transformToWebStream: () =>
        new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array([1, 2]))
            c.close()
          },
        }),
    },
    ContentLength: 2,
  })
})
it('hydrates an authorized internal PDF preview without disclosing storage keys', async () => {
  const result = (
    await boatActivityMessageContent([{ boatActivityId: 'event' }])
  ).get('event')!
  expect(result.preview).toEqual({
    kind: 'pdf',
    title: 'Manual',
    url: '/api/messaging/threads/boat%3Aboat/activity/event/content',
  })
  expect(JSON.stringify(result)).not.toContain('private-key')
})
it('removes previews when the resource was deleted or belongs to another boat', async () => {
  for (const versions of [
    [],
    [{ ...version, document: { boatId: 'other', title: 'Private' } }],
  ]) {
    mocks.versions.mockResolvedValue(versions)
    expect(
      (await boatActivityMessageContent([{ boatActivityId: 'event' }])).get(
        'event',
      )!.preview,
    ).toBeNull()
    expect(await boatActivityContent('boat', 'event')).toBeNull()
  }
  expect(mocks.send).not.toHaveBeenCalled()
})
it('preserves removal labels without requesting removed media', async () => {
  mocks.activity.mockResolvedValue({ ...activity, kind: 'DOCUMENT_REMOVED' })
  expect(await boatActivityContent('boat', 'event')).toBeNull()
  expect(mocks.versions).not.toHaveBeenCalled()
})
it('rejects executable document links and forces unsupported formats to download', async () => {
  mocks.versions.mockResolvedValue([
    { ...version, kind: 'link', url: 'javascript:alert(1)' },
  ])
  expect(
    (await boatActivityMessageContent([{ boatActivityId: 'event' }])).get(
      'event',
    )!.preview,
  ).toBeNull()
  mocks.versions.mockResolvedValue([{ ...version, mimeType: 'text/html' }])
  const response = await boatActivityContent('boat', 'event')
  expect(response?.headers.get('Content-Type')).toBe('application/octet-stream')
  expect(response?.headers.get('Content-Disposition')).toBe('attachment')
  expect(response?.headers.get('Cache-Control')).toBe('private, no-store')
  expect(response?.headers.get('Content-Security-Policy')).toContain('sandbox')
  expect(previewKind('image/svg+xml')).toBe('file')
})
it('supports bounded range requests for video playback', async () => {
  mocks.send.mockResolvedValue({
    Body: { transformToWebStream: () => new ReadableStream() },
    ContentLength: 10,
    ContentRange: 'bytes 10-19/100',
  })
  const response = await boatActivityContent('boat', 'event', 'bytes=10-19')
  expect(response?.status).toBe(206)
  expect(response?.headers.get('Content-Range')).toBe('bytes 10-19/100')
  expect(mocks.send.mock.calls[0][0].input.Range).toBe('bytes=10-19')
  expect(
    (await boatActivityContent('boat', 'event', 'bytes=1-2,4-5'))?.status,
  ).toBe(416)
})

it('returns stored member identity and roles even after membership removal', async () => {
  mocks.activities.mockResolvedValue([
    {
      ...activity,
      resourceType: 'boat_member',
      kind: 'MEMBER_UPDATED',
      label: 'Alex',
      versionId: null,
      memberEmail: 'alex@example.test',
      previousMemberRole: 'MEMBER',
      memberRole: 'ADMIN',
    },
  ])
  const result = (
    await boatActivityMessageContent([{ boatActivityId: 'event' }])
  ).get('event')
  expect(result).toMatchObject({
    label: 'Alex',
    memberEmail: 'alex@example.test',
    previousMemberRole: 'MEMBER',
    memberRole: 'ADMIN',
    preview: null,
  })
})
