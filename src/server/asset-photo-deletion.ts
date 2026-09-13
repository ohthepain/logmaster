import { deletePhotoObject } from './s3-photos'

// Keep the database records if any deletion fails so a retry can find every
// object. Only private document objects are passed here, never catalog media.
export async function deleteAssetDocumentObjects(
  versions: Array<{ s3Key: string | null; previewS3Key?: string | null }>,
) {
  const keys = new Set(
    versions
      .flatMap((version) => [version.s3Key, version.previewS3Key])
      .filter((key): key is string => !!key),
  )
  await Promise.all([...keys].map((key) => deletePhotoObject(key)))
}
