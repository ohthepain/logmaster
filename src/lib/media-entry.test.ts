import { describe, expect, it } from 'vitest'
import type { LogEntry, Media } from '../domain/logbook'
import {
  appendNote,
  buildMediaEntryInput,
  findEntryNearPosition,
  isPromotableMedia,
  MEDIA_ATTACH_RADIUS_M,
  resolvePhotoVideoSave,
} from './media-entry'

function entry(
  partial: Partial<LogEntry> & Pick<LogEntry, 'id'>,
): LogEntry {
  return {
    tripId: 'trip-1',
    type: 'NOTE',
    timestamp: '2026-01-01T12:00:00.000Z',
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    synced: true,
    deleted: false,
    ...partial,
  }
}

describe('findEntryNearPosition', () => {
  it('returns the nearest entry within 50m', () => {
    const anchor = entry({
      id: 'anchor',
      type: 'ANCHOR_DROPPED',
      latitude: 50.763,
      longitude: -1.297,
    })
    const note = entry({
      id: 'note',
      type: 'NOTE',
      latitude: 50.7634,
      longitude: -1.2974,
    })

    const match = findEntryNearPosition(
      [note, anchor],
      { latitude: 50.76305, longitude: -1.29705 },
      MEDIA_ATTACH_RADIUS_M,
    )

    expect(match?.id).toBe('anchor')
  })

  it('ignores entries beyond the radius', () => {
    const far = entry({
      id: 'far',
      latitude: 50.77,
      longitude: -1.297,
    })

    expect(
      findEntryNearPosition(
        [far],
        { latitude: 50.763, longitude: -1.297 },
        MEDIA_ATTACH_RADIUS_M,
      ),
    ).toBeNull()
  })

  it('skips deleted, MEDIA, and excluded entries', () => {
    const deleted = entry({
      id: 'deleted',
      deleted: true,
      latitude: 50.763,
      longitude: -1.297,
    })
    const media = entry({
      id: 'media',
      type: 'MEDIA',
      latitude: 50.763,
      longitude: -1.297,
    })
    const excluded = entry({
      id: 'excluded',
      latitude: 50.763,
      longitude: -1.297,
    })

    expect(
      findEntryNearPosition(
        [deleted, media, excluded],
        { latitude: 50.763, longitude: -1.297 },
        MEDIA_ATTACH_RADIUS_M,
        'excluded',
      ),
    ).toBeNull()
  })
})

describe('resolvePhotoVideoSave', () => {
  it('attaches when a nearby entry exists', () => {
    const nearby = entry({
      id: 'nearby',
      latitude: 50.763,
      longitude: -1.297,
    })

    expect(
      resolvePhotoVideoSave({
        tripId: 'trip-1',
        tripEntries: [nearby],
        capturePosition: { latitude: 50.76301, longitude: -1.29701 },
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
      }),
    ).toEqual({ action: 'attach', entryId: 'nearby' })
  })

  it('creates a MEDIA entry when nothing is nearby', () => {
    const resolution = resolvePhotoVideoSave({
      tripId: 'trip-1',
      tripEntries: [],
      capturePosition: { latitude: 50.763, longitude: -1.297 },
      fileName: 'clip.mov',
      mimeType: 'video/quicktime',
      timestamp: '2026-01-01T12:00:00.000Z',
    })

    expect(resolution.action).toBe('create')
    if (resolution.action === 'create') {
      expect(resolution.entryInput.type).toBe('MEDIA')
      expect(resolution.entryInput.data?.mediaType).toBe('video')
    }
  })

  it('attaches directly when attachEntryId is set', () => {
    expect(
      resolvePhotoVideoSave({
        tripId: 'trip-1',
        tripEntries: [],
        capturePosition: null,
        attachEntryId: 'note-entry',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
      }),
    ).toEqual({ action: 'attach', entryId: 'note-entry' })
  })
})

describe('isPromotableMedia', () => {
  it('promotes photos and videos but not voice notes', () => {
    const photo: Pick<Media, 'type' | 'localPath' | 'remoteUrl' | 'thumbnailUrl'> = {
      type: 'photo',
      localPath: 'photo.jpg',
      remoteUrl: null,
      thumbnailUrl: null,
    }
    const video: Pick<Media, 'type' | 'localPath' | 'remoteUrl' | 'thumbnailUrl'> = {
      type: 'photo',
      localPath: 'clip.mov',
      remoteUrl: null,
      thumbnailUrl: null,
    }
    const voice: Pick<Media, 'type' | 'localPath' | 'remoteUrl' | 'thumbnailUrl'> = {
      type: 'voice',
      localPath: 'voice.webm',
      remoteUrl: 'blob:voice',
      thumbnailUrl: null,
    }

    expect(isPromotableMedia(photo)).toBe(true)
    expect(isPromotableMedia(video)).toBe(true)
    expect(isPromotableMedia(voice)).toBe(false)
  })
})

describe('appendNote', () => {
  it('joins notes with a blank line', () => {
    expect(appendNote('First', 'Second')).toBe('First\n\nSecond')
    expect(appendNote('', 'Second')).toBe('Second')
    expect(appendNote('First', '')).toBe('First')
  })
})

describe('buildMediaEntryInput', () => {
  it('marks video files in entry data', () => {
    const input = buildMediaEntryInput({
      tripId: 'trip-1',
      fileName: 'clip.mp4',
      mimeType: 'video/mp4',
    })
    expect(input.type).toBe('MEDIA')
    expect(input.data?.mediaType).toBe('video')
  })
})
