import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getPhotosS3Client, photosBucket } from './s3-photos'

export async function uploadTrackObject(
  key: string,
  body: Uint8Array | Buffer,
): Promise<void> {
  await getPhotosS3Client().send(
    new PutObjectCommand({
      Bucket: photosBucket(),
      Key: key,
      Body: body,
      ContentType: 'application/octet-stream',
      CacheControl: 'private, max-age=31536000, immutable',
    }),
  )
}

export async function getTrackObject(key: string) {
  return getPhotosS3Client().send(
    new GetObjectCommand({
      Bucket: photosBucket(),
      Key: key,
    }),
  )
}

export async function deleteTrackObject(key: string): Promise<void> {
  await getPhotosS3Client().send(
    new DeleteObjectCommand({
      Bucket: photosBucket(),
      Key: key,
    }),
  )
}

export async function readTrackObjectBytes(key: string): Promise<Uint8Array> {
  const response = await getTrackObject(key)
  const body = response.Body
  if (!body) throw new Error('Track object body is empty')
  return new Uint8Array(await body.transformToByteArray())
}
