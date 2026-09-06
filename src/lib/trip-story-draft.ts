import type { LogEntry, Media, Trip } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import {
  tripCoverPhotoUrl,
  tripDisplayName,
  tripListSubtitle,
} from './trip-display'
import { isVideoMediaFileName } from './media-entry'
import {
  formatTripListDistanceMeters,
  formatTripListDuration,
  tripDurationMs,
  tripListLocationKicker,
  tripTrackDistanceMeters,
} from './trip-list-stats'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatEntryTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function mediaSource(item: Media): string | null {
  if (item.thumbnailUrl) return item.thumbnailUrl
  if (item.type === 'voice') return null
  return item.remoteUrl ?? null
}

function isVideoMedia(item: Media): boolean {
  if (item.type === 'voice') return false
  const paths = [item.localPath, item.remoteUrl, item.thumbnailUrl]
  return paths.some((path) => isVideoMediaFileName(path))
}

function mediaFigureHtml(item: Media, caption: string): string {
  const src = mediaSource(item)
  if (!src) return ''
  const escapedSrc = escapeHtml(src)
  const escapedCaption = escapeHtml(caption)
  const mediaTag = isVideoMedia(item)
    ? `<video controls src="${escapedSrc}"></video>`
    : `<img src="${escapedSrc}" alt="" />`
  return `<figure class="story-photo">${mediaTag}<figcaption>${escapedCaption}</figcaption></figure>`
}

type TimelineItem = {
  timeMs: number
  order: number
  html: string
}

type BuildTripStoryDraftInput = {
  trip: Trip
  entries: LogEntry[]
  mediaByEntry: Map<string, Media[]>
  tracks: TripTrack[]
}

export function buildTripStoryDraft({
  trip,
  entries,
  mediaByEntry,
  tracks,
}: BuildTripStoryDraftInput): string {
  const title = tripDisplayName(trip)
  const subtitle = tripListSubtitle(trip)
  const location = tripListLocationKicker(trip)
  const distanceM = tripTrackDistanceMeters(trip.id, tracks)
  const durationMs = tripDurationMs(trip)
  const activeEntries = entries.filter((entry) => !entry.deleted)

  const parts: string[] = ['<div class="trip-story">']

  if (location) {
    parts.push(`<p class="story-kicker">${escapeHtml(location)}</p>`)
  }
  parts.push(`<h1>${escapeHtml(title)}</h1>`)
  if (subtitle) {
    parts.push(`<p class="story-lead"><em>${escapeHtml(subtitle)}</em></p>`)
  }

  const statBlocks: string[] = []
  statBlocks.push(
    `<div class="story-stat"><span class="story-stat-label">Distance</span><span class="story-stat-value">${escapeHtml(formatTripListDistanceMeters(distanceM))}</span></div>`,
  )
  statBlocks.push(
    `<div class="story-stat"><span class="story-stat-label">Duration</span><span class="story-stat-value">${escapeHtml(formatTripListDuration(durationMs))}</span></div>`,
  )
  if (activeEntries.length > 0) {
    statBlocks.push(
      `<div class="story-stat"><span class="story-stat-label">Log entries</span><span class="story-stat-value">${activeEntries.length}</span></div>`,
    )
  }
  parts.push(`<div class="story-stats">${statBlocks.join('')}</div>`)

  const timelineItems: TimelineItem[] = []
  const usedMediaUrls = new Set<string>()
  let sequence = 0

  const coverUrl = tripCoverPhotoUrl(trip)
  if (coverUrl) {
    const startedMs = new Date(trip.startedAt).getTime()
    timelineItems.push({
      timeMs: Number.isNaN(startedMs) ? 0 : startedMs,
      order: sequence++,
      html: `<figure class="story-photo"><img src="${escapeHtml(coverUrl)}" alt="" /><figcaption>${escapeHtml(formatEntryTimestamp(trip.startedAt))}</figcaption></figure>`,
    })
    usedMediaUrls.add(coverUrl)
  }

  const timelineEntries = [...activeEntries].sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  )

  for (const entry of timelineEntries) {
    const entryTimeMs = new Date(entry.timestamp).getTime()
    const timeMs = Number.isNaN(entryTimeMs) ? 0 : entryTimeMs
    const caption = formatEntryTimestamp(entry.timestamp)

    const note = entry.notes?.trim()
    if (note) {
      timelineItems.push({
        timeMs,
        order: sequence++,
        html: `<div class="story-note"><time datetime="${escapeHtml(entry.timestamp)}">${escapeHtml(caption)}</time><p>${escapeHtml(note).replace(/\n/g, '<br />')}</p></div>`,
      })
    }

    const entryMedia = (mediaByEntry.get(entry.id) ?? [])
      .filter((item) => item.type !== 'voice')
      .sort((left, right) => left.order - right.order)

    for (const item of entryMedia) {
      const src = mediaSource(item)
      if (!src || usedMediaUrls.has(src)) continue
      usedMediaUrls.add(src)
      const figure = mediaFigureHtml(item, caption)
      if (!figure) continue
      timelineItems.push({
        timeMs: timeMs + item.order,
        order: sequence++,
        html: figure,
      })
    }
  }

  timelineItems.sort((left, right) => {
    if (left.timeMs !== right.timeMs) return left.timeMs - right.timeMs
    return left.order - right.order
  })

  if (timelineItems.length > 0) {
    parts.push(
      `<div class="story-timeline">${timelineItems.map((item) => item.html).join('\n')}</div>`,
    )
  }

  parts.push('</div>')
  return parts.join('\n')
}
