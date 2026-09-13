import { beforeEach, expect, it, vi } from 'vitest'
import { deleteAssetDocumentObjects } from './asset-photo-deletion'

const remove = vi.hoisted(() => vi.fn())
vi.mock('./s3-photos', () => ({ deletePhotoObject: remove }))
beforeEach(() => vi.resetAllMocks())
it('deletes both the original and its preview, without touching any catalog object', async () => {
  await deleteAssetDocumentObjects([
    {
      s3Key: 'users/u/boats/b/original.png',
      previewS3Key: 'users/u/boats/b/preview.jpg',
    },
  ])
  expect(remove.mock.calls).toEqual([
    ['users/u/boats/b/original.png'],
    ['users/u/boats/b/preview.jpg'],
  ])
})
it('reports storage failures so the document remains retryable', async () => {
  remove.mockRejectedValue(new Error('Storage unavailable'))
  await expect(
    deleteAssetDocumentObjects([{ s3Key: 'private-original' }]),
  ).rejects.toThrow('Storage unavailable')
})
