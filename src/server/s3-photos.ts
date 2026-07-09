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
