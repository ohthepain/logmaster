import { describe, expect, it } from 'vitest'
import type { LogEntry, Media } from '../domain/logbook'
import {
  buildPlaybackTimelineMediaMarkers,
  entryHasPlaybackMedia,
  playbackMediaMarkerOffsets,
  tripHasPlaybackMedia,
} from './trip-playback-media-timeline'

const entry = (partial: Partial<LogEntry> & Pick<LogEntry, 'id' | 'type'>): LogEntry =>
  ({
    tripId: 'trip-1',
    timestamp: '2026-06-01T10:00:00.000Z',
    deleted: false,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    synced: false,
    ...partial,
  }) as LogEntry

const media = (partial: Partial<Media> & Pick<Media, 'id' | 'logEntryId'>): Media =>
  ({
    type: 'photo',
    order: 0,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    synced: false,
    ...partial,
  }) as Media

describe('trip-playback-media-timeline', () => {
  it('detects media on MEDIA entries and attached media', () => {
    const note = entry({ id: 'note', type: 'NOTE' })
    const mediaEntry = entry({ id: 'media', type: 'MEDIA' })
    const map = new Map<string, Media[]>([
      ['note', [media({ id: 'm1', logEntryId: 'note', thumbnailUrl: 'data:image/jpeg;base64,x' })]],
    ])

    expect(entryHasPlaybackMedia(note, map.get('note') ?? [])).toBe(true)
    expect(entryHasPlaybackMedia(mediaEntry, [])).toBe(true)
    expect(tripHasPlaybackMedia([note, mediaEntry], map)).toBe(true)
  })

  it('builds markers for MEDIA entries, attached photos, and voice notes', () => {
    const mediaEntry = entry({ id: 'media', type: 'MEDIA' })
    const note = entry({ id: 'note', type: 'NOTE' })
    const voice = entry({
      id: 'voice',
      type: 'NOTE',
      data: { voiceNote: true },
    })
    const map = new Map<string, Media[]>([
      [
        'media',
        [media({ id: 'm-media', logEntryId: 'media', thumbnailUrl: 'thumb-media' })],
      ],
      [
        'note',
        [
          media({ id: 'm-photo', logEntryId: 'note', order: 0, thumbnailUrl: 'thumb-photo' }),
          media({ id: 'm-voice', logEntryId: 'note', order: 1, type: 'voice' }),
        ],
      ],
    ])

    const markers = buildPlaybackTimelineMediaMarkers(
      [mediaEntry, note, voice],
      map,
    )

    expect(markers).toHaveLength(4)
    expect(markers.map((marker) => marker.kind).sort()).toEqual([
      'photo',
      'photo',
      'voice',
      'voice',
    ])
  })

  it('offsets markers that share a timestamp', () => {
    const timeMs = Date.parse('2026-06-01T10:00:00.000Z')
    const offsets = playbackMediaMarkerOffsets([
      { id: 'a', entryId: 'e1', timeMs, kind: 'photo', thumbnailUrl: null },
      { id: 'b', entryId: 'e1', timeMs, kind: 'photo', thumbnailUrl: null },
    ])
    expect(offsets.get('a')).toBe(-7)
    expect(offsets.get('b')).toBe(7)
  })
})
