import { describe, expect, it } from 'vitest'
import type { LogEntry, Media, Trip } from '../domain/logbook'
import { buildTripStoryDraft } from './trip-story-draft'

const trip: Trip = {
  id: 'trip-1',
  boatName: 'Sea Breeze',
  title: 'Croatia crossing',
  subtitle: 'Split to Hvar',
  coverPhotoDataUrl: 'https://example.com/cover.jpg',
  startedAt: '2026-08-01T08:00:00.000Z',
  completedAt: '2026-08-01T18:00:00.000Z',
  status: 'COMPLETED',
  startCountry: 'Croatia',
  createdAt: '2026-08-01T07:00:00.000Z',
  updatedAt: '2026-08-01T18:00:00.000Z',
}

const noteEntry: LogEntry = {
  id: 'entry-note',
  tripId: trip.id,
  type: 'NOTE',
  timestamp: '2026-08-01T09:00:00.000Z',
  notes: 'Calm morning sail',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
  synced: true,
  deleted: false,
}

const photoMedia: Media = {
  id: 'media-1',
  logEntryId: 'entry-photo',
  type: 'photo',
  order: 0,
  thumbnailUrl: 'https://example.com/photo.jpg',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  synced: true,
}

describe('buildTripStoryDraft', () => {
  it('builds a hero, stats, and chronological timeline from trip data', () => {
    const html = buildTripStoryDraft({
      trip,
      entries: [noteEntry],
      mediaByEntry: new Map(),
      tracks: [],
    })

    expect(html).toContain('class="trip-story"')
    expect(html).toContain('<h1>Croatia crossing</h1>')
    expect(html).toContain('<em>Split to Hvar</em>')
    expect(html).toContain('class="story-stats"')
    expect(html).toContain('https://example.com/cover.jpg')
    expect(html).toContain('Croatia')
    expect(html).toContain('class="story-note"')
    expect(html).toContain('Calm morning sail')
    expect(html.indexOf('cover.jpg')).toBeLessThan(html.indexOf('Calm morning sail'))
  })

  it('embeds photo media in the timeline grid', () => {
    const photoEntry: LogEntry = {
      id: 'entry-photo',
      tripId: trip.id,
      type: 'PHOTO',
      timestamp: '2026-08-01T10:00:00.000Z',
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
      synced: true,
      deleted: false,
    }

    const html = buildTripStoryDraft({
      trip,
      entries: [photoEntry],
      mediaByEntry: new Map([[photoEntry.id, [photoMedia]]]),
      tracks: [],
    })

    expect(html).toContain('class="story-timeline"')
    expect(html).toContain('class="story-photo"')
    expect(html).toContain('https://example.com/photo.jpg')
  })
})
