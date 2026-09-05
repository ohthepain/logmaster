import type { LogEntry, Media } from '../domain/logbook'
import { isVideoLogEntry } from './log-entry-map-marker'
import { isVideoMediaFileName } from './media-entry'

export type PlaybackTimelineMediaKind = 'photo' | 'video' | 'voice'

export type PlaybackTimelineMediaMarker = {
  id: string
  entryId: string
  timeMs: number
  kind: PlaybackTimelineMediaKind
  thumbnailUrl: string | null
  mediaId?: string
}

function mediaItemKind(item: Media): PlaybackTimelineMediaKind {
  if (item.type === 'voice') return 'voice'
  const paths = [item.localPath, item.remoteUrl, item.thumbnailUrl]
  if (paths.some((path) => isVideoMediaFileName(path))) return 'video'
  return 'photo'
}

function mediaThumbnail(item: Media): string | null {
  if (item.thumbnailUrl) return item.thumbnailUrl
  if (item.type === 'voice') return null
  return item.remoteUrl ?? null
}

export function entryHasPlaybackMedia(
  entry: LogEntry,
  media: Media[],
): boolean {
  if (entry.type === 'MEDIA') return true
  if (media.length > 0) return true
  if (entry.type === 'VOICE_NOTE' || entry.data?.voiceNote === true) return true
  if (entry.type === 'PHOTO') return true
  return isVideoLogEntry(entry)
}

export function tripHasPlaybackMedia(
  entries: LogEntry[],
  mediaByEntry: Map<string, Media[]>,
): boolean {
  return entries.some(
    (entry) =>
      !entry.deleted &&
      entryHasPlaybackMedia(entry, mediaByEntry.get(entry.id) ?? []),
  )
}

export function buildPlaybackTimelineMediaMarkers(
  entries: LogEntry[],
  mediaByEntry: Map<string, Media[]>,
): PlaybackTimelineMediaMarker[] {
  const markers: PlaybackTimelineMediaMarker[] = []

  for (const entry of entries) {
    if (entry.deleted) continue
    const timeMs = Date.parse(entry.timestamp)
    if (!Number.isFinite(timeMs)) continue

    const media = [...(mediaByEntry.get(entry.id) ?? [])].sort(
      (left, right) => left.order - right.order,
    )

    if (entry.type === 'MEDIA') {
      const entryIsVideo = isVideoLogEntry(entry)
      const thumbMedia = media.find(
        (item) => item.thumbnailUrl || item.remoteUrl,
      )
      markers.push({
        id: `media-entry-${entry.id}`,
        entryId: entry.id,
        timeMs,
        kind: entryIsVideo ? 'video' : 'photo',
        thumbnailUrl: thumbMedia ? mediaThumbnail(thumbMedia) : null,
      })
      continue
    }

    if (media.length > 0) {
      for (const item of media) {
        markers.push({
          id: item.id,
          entryId: entry.id,
          timeMs,
          kind: mediaItemKind(item),
          thumbnailUrl: mediaThumbnail(item),
          mediaId: item.id,
        })
      }
      continue
    }

    if (entry.type === 'VOICE_NOTE' || entry.data?.voiceNote === true) {
      markers.push({
        id: `voice-entry-${entry.id}`,
        entryId: entry.id,
        timeMs,
        kind: 'voice',
        thumbnailUrl: null,
      })
    }
  }

  return markers.sort(
    (left, right) =>
      left.timeMs - right.timeMs || left.id.localeCompare(right.id),
  )
}

/** Spread markers that share the same timestamp so thumbnails don't overlap. */
export function playbackMediaMarkerOffsets(
  markers: PlaybackTimelineMediaMarker[],
): Map<string, number> {
  const offsets = new Map<string, number>()
  const byTime = new Map<number, PlaybackTimelineMediaMarker[]>()

  for (const marker of markers) {
    const bucket = byTime.get(marker.timeMs) ?? []
    bucket.push(marker)
    byTime.set(marker.timeMs, bucket)
  }

  for (const group of byTime.values()) {
    group.forEach((marker, index) => {
      offsets.set(marker.id, (index - (group.length - 1) / 2) * 14)
    })
  }

  return offsets
}
