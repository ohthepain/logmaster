import { GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '../db'
import {
  contentTypeForStoredDocument,
  getPhotosS3Client,
  photosBucket,
} from '../s3-photos'
import { boatActivityKinds } from '../../domain/boat-activity'
import type {
  BoatChatActivity,
  BoatActivityKind,
} from '../../domain/boat-activity'

export function previewKind(
  mime: string,
): NonNullable<BoatChatActivity['preview']>['kind'] {
  if (/^image\/(jpeg|png|gif|webp|avif|heic|heif)$/.test(mime)) return 'image'
  if (/^video\/(mp4|quicktime|webm)$/.test(mime)) return 'video'
  if (/^audio\/(webm|mp4|mpeg|ogg|wav|aac)$/.test(mime)) return 'audio'
  return mime === 'application/pdf' ? 'pdf' : 'file'
}

/** Only canonical resources belonging to this boat can supply a preview. Never copy S3 keys into chat. */
async function sources(
  activities: {
    resourceType: string
    resourceId: string
    boatId: string
    versionId: string | null
  }[],
) {
  const [photos, versions] = await Promise.all([
    prisma.boatPhoto.findMany({
      where: {
        id: {
          in: activities
            .filter((a) => a.resourceType === 'boat_photo')
            .map((a) => a.resourceId),
        },
      },
    }),
    prisma.boatDocumentVersion.findMany({
      where: {
        id: {
          in: activities.flatMap((a) => (a.versionId ? [a.versionId] : [])),
        },
      },
      include: { document: true },
    }),
  ])
  return activities.map((activity) => {
    if (activity.resourceType === 'boat_photo') {
      const photo = photos.find(
        (p) => p.id === activity.resourceId && p.boatId === activity.boatId,
      )
      return photo
        ? {
            key: photo.s3Key,
            mime: photo.mimeType,
            title: photo.caption ?? '',
            link: null,
          }
        : null
    }
    const version = versions.find(
      (v) =>
        v.id === activity.versionId &&
        v.documentId === activity.resourceId &&
        v.document.boatId === activity.boatId,
    )
    if (!version) return null
    if (version.kind === 'link') {
      try {
        const link = new URL(version.url ?? '')
        return ['https:', 'http:'].includes(link.protocol)
          ? {
              key: null,
              mime: '',
              title: version.document.title,
              link: link.href,
            }
          : null
      } catch {
        return null
      }
    }
    return version.s3Key
      ? {
          key: version.s3Key,
          mime: contentTypeForStoredDocument(
            version.mimeType,
            version.fileName,
          ),
          title: version.document.title,
          link: null,
        }
      : null
  })
}

export async function boatActivityMessageContent(
  rows: { boatActivityId?: string | null }[],
) {
  const ids = rows.flatMap((row) =>
    row.boatActivityId ? [row.boatActivityId] : [],
  )
  if (!ids.length) return new Map<string, BoatChatActivity>()
  const activities = await prisma.boatActivity.findMany({
    where: { id: { in: ids } },
  })
  const resources = await sources(activities)
  return new Map(
    activities.map((activity, index) => {
      const resource = activity.kind.endsWith('_REMOVED')
        ? null
        : resources[index]
      const preview = resource
        ? {
            kind: resource.link
              ? ('link' as const)
              : previewKind(resource.mime),
            title: resource.title,
            url:
              resource.link ??
              `/api/messaging/threads/${encodeURIComponent(`boat:${activity.boatId}`)}/activity/${activity.id}/content`,
          }
        : null
      return [
        activity.id,
        {
          id: activity.id,
          kind: (boatActivityKinds.includes(activity.kind as BoatActivityKind)
            ? activity.kind
            : 'ASSET_UPDATED') as BoatActivityKind,
          label: activity.label,
          targetLabel: activity.targetLabel,
          preview,
        },
      ]
    }),
  )
}

/** Caller must require current boat-chat membership. Recheck the resource on every fetch. */
export async function boatActivityContent(
  boatId: string,
  id: string,
  range?: string,
) {
  const activity = await prisma.boatActivity.findFirst({
    where: { id, boatId },
  })
  if (!activity || activity.kind.endsWith('_REMOVED')) return null
  const [source] = await sources([activity])
  if (!source?.key) return null
  if (range && !/^bytes=\d*-\d*$/.test(range))
    return new Response(null, { status: 416 })
  const object = await getPhotosS3Client()
    .send(
      new GetObjectCommand({
        Bucket: photosBucket(),
        Key: source.key,
        ...(range ? { Range: range } : {}),
      }),
    )
    .catch((error) => {
      if (['NoSuchKey', 'NotFound'].includes(error.name)) return null
      if (error.name === 'InvalidRange') return null
      throw error
    })
  if (!object?.Body) return null
  const headers = new Headers({
    'Content-Type':
      previewKind(source.mime) === 'file'
        ? 'application/octet-stream'
        : source.mime,
    'Content-Disposition':
      previewKind(source.mime) === 'file' ? 'attachment' : 'inline',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'Accept-Ranges': 'bytes',
  })
  if (object.ContentLength != null)
    headers.set('Content-Length', String(object.ContentLength))
  if (object.ContentRange) headers.set('Content-Range', object.ContentRange)
  return new Response(object.Body.transformToWebStream(), {
    status: object.ContentRange ? 206 : 200,
    headers,
  })
}
