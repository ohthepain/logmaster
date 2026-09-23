import { prisma } from '../db'
import type { ChatMessage, TripChatLog } from '../../domain/messaging'
import { mediaDescriptor } from './media'
import { isVideoMediaFileName } from '../../lib/media-entry'
import { entryPlaceFromData } from '../../lib/logbook-place'

/** Keep IDs stable across offline retries. Content is read from the canonical log. */
export function tripLogChatWrites(
  entries: {
    id: unknown
    tripId: unknown
    deleted?: unknown
    timestamp?: unknown
  }[],
  actorId: string,
) {
  const arrival = Date.now()
  const time = (value: unknown) =>
    typeof value === 'string' ? Date.parse(value) || 0 : 0
  return entries
    .filter((entry) => !entry.deleted)
    .sort((a, b) => time(a.timestamp) - time(b.timestamp))
    .map((entry, index) =>
      prisma.chatMessage.upsert({
        where: { logEntryId: String(entry.id) },
        create: {
          id: crypto.randomUUID(),
          threadId: `trip:${entry.tripId}`,
          senderId: actorId,
          // PostgreSQL now() is constant throughout a transaction. Give offline
          // batches a stable occurrence order instead of sorting them by random IDs.
          createdAt: new Date(arrival + index),
          text: '',
          references: [],
          logEntryId: String(entry.id),
        },
        update: { threadId: `trip:${entry.tripId}` },
      }),
    )
}
export const visibleChatMessage = {
  OR: [
    { logEntryId: null },
    { logEntry: { deleted: false, economyHidden: false } },
  ],
}

export async function tripLogMessageContent(
  rows: { id: string; logEntryId?: string | null }[],
) {
  const ids = rows.flatMap((row) => (row.logEntryId ? [row.logEntryId] : []))
  if (!ids.length)
    return new Map<
      string,
      { logEntry: TripChatLog; media: NonNullable<ChatMessage['media']> }
    >()
  const entries = await prisma.logEntry.findMany({
    where: { id: { in: ids }, deleted: false, economyHidden: false },
    include: {
      media: {
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        include: { chatMedia: true },
      },
    },
  })
  return new Map(
    entries.map((entry) => [
      entry.id,
      {
        logEntry: {
          id: entry.id,
          type: entry.type,
          timestamp: entry.timestamp.toISOString(),
          notes: entry.notes,
          latitude: entry.latitude,
          longitude: entry.longitude,
          place: entryPlaceFromData(
            entry.data &&
              typeof entry.data === 'object' &&
              !Array.isArray(entry.data)
              ? (entry.data as Record<string, unknown>)
              : null,
          ),
          legacyMedia: entry.media
            .filter(
              (item) =>
                !item.chatMedia && (item.remoteUrl || item.thumbnailUrl),
            )
            .map((item) => ({
              id: item.id,
              kind:
                item.type === 'voice'
                  ? ('voice' as const)
                  : isVideoMediaFileName(item.localPath) ||
                      item.remoteUrl?.startsWith('data:video/')
                    ? ('video' as const)
                    : ('photo' as const),
              url: `/api/messaging/threads/${encodeURIComponent(`trip:${entry.tripId}`)}/log-media/${encodeURIComponent(item.id)}`,
            })),
        },
        media: [
          ...new Map(
            entry.media
              .flatMap((item) =>
                item.chatMedia?.uploadedAt
                  ? [mediaDescriptor(item.chatMedia)]
                  : [],
              )
              .map((item) => [item.id, item]),
          ).values(),
        ],
      },
    ]),
  )
}

/** Do not fetch arbitrary stored URLs. Legacy inline assets and owned story media only. */
export async function legacyTripLogMedia(tripId: string, mediaId: string) {
  const media = await prisma.media.findFirst({
    where: {
      id: mediaId,
      chatMediaId: null,
      logEntry: { tripId, deleted: false, economyHidden: false },
    },
  })
  if (!media) return null
  const source =
    media.remoteUrl && !media.remoteUrl.startsWith('blob:')
      ? media.remoteUrl
      : media.thumbnailUrl
  if (!source) return null
  const inline =
    /^data:((?:image\/(?:jpeg|png|gif|webp|avif)|video\/(?:mp4|quicktime|webm)|audio\/(?:webm|mp4|mpeg|ogg|wav|aac))(?:;[^,;]+)*);base64,([a-zA-Z0-9+/=\s]+)$/.exec(
      source,
    )
  if (inline)
    return new Response(new Uint8Array(Buffer.from(inline[2], 'base64')), {
      headers: {
        'Content-Type': inline[1].split(';')[0],
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  let path = source
  if (/^https?:\/\//.test(source)) {
    try {
      path = new URL(source).pathname
    } catch {
      return null
    }
  }
  const match =
    /^\/api\/logbook\/trips\/([^/]+)\/story\/media\/([^/]+)\/content$/.exec(
      path,
    )
  if (!match || decodeURIComponent(match[1]) !== tripId) return null
  const storyMedia = await prisma.tripStoryMedia.findFirst({
    where: { id: decodeURIComponent(match[2]), tripId },
  })
  if (
    !storyMedia ||
    !/^(image\/(jpeg|png|gif|webp|avif)|video\/(mp4|quicktime|webm))$/.test(
      storyMedia.mimeType,
    )
  )
    return null
  const { getPhotoObject } = await import('../s3-photos')
  const object = await getPhotoObject(storyMedia.s3Key)
  return object.Body
    ? new Response(object.Body.transformToWebStream(), {
        headers: {
          'Content-Type': storyMedia.mimeType,
          'Cache-Control': 'private, no-cache',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    : null
}
