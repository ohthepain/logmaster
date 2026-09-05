import type { LogEntry, Media } from '../domain/logbook'
import { isVideoMediaData } from '../domain/logbook'
import { haversineMeters } from './place-reverse-lookup'

export const MEDIA_ATTACH_RADIUS_M = 50

const VIDEO_MEDIA_EXTENSIONS = /\.(mp4|mov|m4v|webm)$/i

export type MapCapturePosition = {
  latitude: number
  longitude: number
}

export type MediaEntryInput = {
  tripId: string
  type: 'MEDIA'
  latitude?: number | null
  longitude?: number | null
  timestamp?: string
  data?: Record<string, unknown>
}

export type PhotoVideoSaveResolution =
  | { action: 'attach'; entryId: string }
  | { action: 'create'; entryInput: MediaEntryInput }

export function isVideoMediaFileName(name: string | null | undefined): boolean {
  if (!name) return false
  return VIDEO_MEDIA_EXTENSIONS.test(name)
}

export function isVideoMimeType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('video/')
}

export function isPromotableMedia(
  media: Pick<Media, 'type' | 'localPath' | 'remoteUrl' | 'thumbnailUrl'>,
): boolean {
  if (media.type === 'voice') return false
  if (media.type === 'photo') {
    const paths = [media.localPath, media.remoteUrl, media.thumbnailUrl]
    if (paths.some((path) => isVideoMediaFileName(path))) return true
    return true
  }
  const paths = [media.localPath, media.remoteUrl, media.thumbnailUrl]
  return paths.some((path) => isVideoMediaFileName(path))
}

export function mediaFileData(
  fileName: string,
  mimeType: string,
  size?: number,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    fileName,
    mimeType,
  }
  if (size != null) data.size = size
  if (isVideoMimeType(mimeType) || isVideoMediaFileName(fileName)) {
    data.mediaType = 'video'
  }
  return data
}

export function buildMediaEntryInput(args: {
  tripId: string
  timestamp?: string
  latitude?: number | null
  longitude?: number | null
  fileName: string
  mimeType: string
  size?: number
}): MediaEntryInput {
  return {
    tripId: args.tripId,
    type: 'MEDIA',
    latitude: args.latitude ?? null,
    longitude: args.longitude ?? null,
    timestamp: args.timestamp,
    data: mediaFileData(args.fileName, args.mimeType, args.size),
  }
}

export function buildPromotedMediaEntryInput(
  parent: Pick<
    LogEntry,
    'tripId' | 'legId' | 'timestamp' | 'latitude' | 'longitude' | 'data'
  >,
  media: Pick<Media, 'localPath' | 'remoteUrl' | 'thumbnailUrl' | 'type'>,
): MediaEntryInput {
  const fileName =
    media.localPath ??
    media.remoteUrl?.split('/').pop()?.split('?')[0] ??
    'photo.jpg'
  const mimeType =
    isVideoMediaFileName(fileName) || isVideoMediaFileName(media.localPath)
      ? 'video/mp4'
      : 'image/jpeg'
  return {
    tripId: parent.tripId,
    type: 'MEDIA',
    latitude: parent.latitude ?? null,
    longitude: parent.longitude ?? null,
    timestamp: parent.timestamp,
    data: {
      ...mediaFileData(fileName, mimeType),
      promotedFromEntry: true,
    },
  }
}

export function hasCapturePosition(
  position: MapCapturePosition | null | undefined,
): position is MapCapturePosition {
  return (
    position != null &&
    Number.isFinite(position.latitude) &&
    Number.isFinite(position.longitude)
  )
}

export function findEntryNearPosition<
  T extends Pick<LogEntry, 'id' | 'deleted' | 'latitude' | 'longitude' | 'type'>,
>(
  entries: T[],
  position: MapCapturePosition,
  radiusM = MEDIA_ATTACH_RADIUS_M,
  excludeEntryId?: string,
): T | null {
  let nearest: T | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const entry of entries) {
    if (entry.deleted) continue
    if (excludeEntryId && entry.id === excludeEntryId) continue
    if (entry.type === 'MEDIA') continue
    if (entry.latitude == null || entry.longitude == null) continue
    if (!Number.isFinite(entry.latitude) || !Number.isFinite(entry.longitude)) {
      continue
    }

    const distanceM = haversineMeters(
      position.latitude,
      position.longitude,
      entry.latitude,
      entry.longitude,
    )
    if (distanceM > radiusM) continue
    if (distanceM < nearestDistance) {
      nearest = entry
      nearestDistance = distanceM
    }
  }

  return nearest
}

export function resolvePhotoVideoSave(args: {
  tripId: string
  tripEntries: Array<
    Pick<LogEntry, 'id' | 'deleted' | 'latitude' | 'longitude' | 'type'>
  >
  capturePosition: MapCapturePosition | null
  attachEntryId?: string
  excludeEntryId?: string
  fileName: string
  mimeType: string
  size?: number
  timestamp?: string
}): PhotoVideoSaveResolution {
  if (args.attachEntryId) {
    return { action: 'attach', entryId: args.attachEntryId }
  }

  if (hasCapturePosition(args.capturePosition)) {
    const nearby = findEntryNearPosition(
      args.tripEntries,
      args.capturePosition,
      MEDIA_ATTACH_RADIUS_M,
      args.excludeEntryId,
    )
    if (nearby) {
      return { action: 'attach', entryId: nearby.id }
    }
  }

  return {
    action: 'create',
    entryInput: buildMediaEntryInput({
      tripId: args.tripId,
      timestamp: args.timestamp,
      latitude: args.capturePosition?.latitude ?? null,
      longitude: args.capturePosition?.longitude ?? null,
      fileName: args.fileName,
      mimeType: args.mimeType,
      size: args.size,
    }),
  }
}

export function appendNote(existing: string | null | undefined, note: string): string {
  const trimmed = note.trim()
  if (!trimmed) return existing?.trim() ?? ''
  const current = existing?.trim() ?? ''
  if (!current) return trimmed
  return `${current}\n\n${trimmed}`
}

export function entryShowsAsMediaTitle(
  entry: Pick<LogEntry, 'type' | 'data'>,
): boolean {
  return entry.type === 'MEDIA' || isVideoMediaData(entry.data)
}
