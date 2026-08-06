import { gunzipSync } from 'node:zlib'
import { GetObjectCommand, NoSuchKey, type S3Client } from '@aws-sdk/client-s3'

export async function readS3GzipJson(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<unknown | null> {
  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    )
    const bytes = await response.Body?.transformToByteArray()
    if (!bytes) return null
    const encoding = response.ContentEncoding?.toLowerCase()
    const raw =
      encoding === 'gzip'
        ? gunzipSync(Buffer.from(bytes))
        : Buffer.from(bytes)
    return JSON.parse(raw.toString('utf8'))
  } catch (error) {
    if (
      error instanceof NoSuchKey ||
      (typeof error === 'object' &&
        error != null &&
        'name' in error &&
        (error as { name?: string }).name === 'NoSuchKey')
    ) {
      return null
    }
    throw error
  }
}
