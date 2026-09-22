import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ChatMessage, TripChatLog } from '../domain/messaging'
import type { LogEntry } from '../domain/logbook'
import { AUTO_GENERATED_ENTRY_NOTE } from '../domain/instrument-data'
import { useTranslation } from '../lib/i18n'
import { apiUrl } from '../lib/app-origin'
import { formatPosition } from '../lib/logbook-format'
import { formatLogEntryPlace, lookupLogEntryPlace } from '../lib/logbook-place'
import { generateLegColor } from '../lib/leg-colors'
import { cn } from '../lib/cn'
import { MessageMedia } from './MessageMedia'
import { PlaybackTimelineLogEntryMarker } from './PlaybackTimelineLogEntryMarker'
import { TripChatPositionMap } from './TripChatPositionMap'

export function plainTripLog(entry: TripChatLog) {
  return !['PHOTO', 'MEDIA', 'VOICE_NOTE'].includes(entry.type)
}

function hasValidCoordinates(entry: TripChatLog) {
  return (
    entry.latitude != null &&
    entry.longitude != null &&
    Number.isFinite(entry.latitude) &&
    Number.isFinite(entry.longitude) &&
    Math.abs(entry.latitude) <= 90 &&
    Math.abs(entry.longitude) <= 180
  )
}

export function tripChatThreadTripId(threadId: string): string | null {
  return threadId.startsWith('trip:') ? threadId.slice(5) : null
}

function TripHourlyLogContent({
  entry,
  tripId,
}: {
  entry: TripChatLog
  tripId: string | null
}) {
  const { t, language } = useTranslation()
  const [mapOpen, setMapOpen] = useState(false)
  const coordinates = hasValidCoordinates(entry)
  const [placeLabel, setPlaceLabel] = useState<string | null>(() =>
    entry.place ? formatLogEntryPlace(entry.place) : null,
  )

  const markerEntry = useMemo(
    (): LogEntry => ({
      id: entry.id,
      tripId: tripId ?? '',
      type: 'HOURLY_LOG',
      timestamp: entry.timestamp,
      notes: entry.notes,
      data: null,
      createdAt: entry.timestamp,
      updatedAt: entry.timestamp,
      synced: true,
      deleted: false,
    }),
    [entry.id, entry.notes, entry.timestamp, tripId],
  )

  useEffect(() => {
    if (entry.place) {
      setPlaceLabel(formatLogEntryPlace(entry.place))
      return
    }
    if (!coordinates) {
      setPlaceLabel(null)
      return
    }
    let cancelled = false
    void lookupLogEntryPlace(entry.latitude!, entry.longitude!).then(
      (place) => {
        if (cancelled) return
        setPlaceLabel(place ? formatLogEntryPlace(place) : null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [coordinates, entry.latitude, entry.longitude, entry.place])

  const notes =
    entry.notes && entry.notes !== AUTO_GENERATED_ENTRY_NOTE
      ? entry.notes
      : null

  const timeLabel = new Date(entry.timestamp).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const coordsLabel = coordinates
    ? formatPosition(entry.latitude, entry.longitude)
    : null
  const mapLabel = mapOpen ? t('tripChat_hideMap') : t('tripChat_showMap')

  return (
    <div
      className="mx-auto w-[22.5rem] max-w-full space-y-2 text-left"
      data-trip-log-type={entry.type}
    >
      <button
        type="button"
        aria-expanded={mapOpen}
        aria-label={
          coordinates
            ? `${timeLabel}${placeLabel ? ` · ${placeLabel}` : ''}${coordsLabel ? ` · ${coordsLabel}` : ''} · ${mapLabel}`
            : mapLabel
        }
        disabled={!coordinates}
        onClick={() => coordinates && setMapOpen((open) => !open)}
        className={cn(
          'flex w-full min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-left text-xs text-slate-700',
          coordinates
            ? 'transition hover:bg-slate-50'
            : 'cursor-default opacity-80',
        )}
      >
        <PlaybackTimelineLogEntryMarker
          entry={markerEntry}
          legColor={generateLegColor(0)}
          className="shrink-0"
        />
        <time
          dateTime={entry.timestamp}
          className="shrink-0 tabular-nums font-semibold"
        >
          {timeLabel}
        </time>
        {placeLabel ? (
          <span className="min-w-0 truncate text-slate-800">{placeLabel}</span>
        ) : null}
        {coordsLabel ? (
          <span className="shrink-0 tabular-nums text-slate-500">
            {coordsLabel}
          </span>
        ) : null}
        {coordinates ? (
          <ChevronDown
            className={cn(
              'ml-auto size-3.5 shrink-0 text-slate-500 transition',
              mapOpen && 'rotate-180',
            )}
            aria-hidden
          />
        ) : null}
      </button>
      {mapOpen && coordinates ? (
        <TripChatPositionMap
          tripId={tripId}
          timestamp={entry.timestamp}
          latitude={entry.latitude!}
          longitude={entry.longitude!}
        />
      ) : null}
      {notes ? (
        <p className="m-0 whitespace-pre-wrap break-words text-sm text-slate-800">
          {notes}
        </p>
      ) : null}
    </div>
  )
}

export function TripLogContent({
  entry,
  tripId = null,
}: {
  entry: TripChatLog
  tripId?: string | null
}) {
  const { t, language } = useTranslation()

  if (entry.type === 'HOURLY_LOG') {
    return <TripHourlyLogContent entry={entry} tripId={tripId} />
  }

  return (
    <div className="space-y-2" data-trip-log-type={entry.type}>
      <p className="m-0 text-xs text-slate-600">
        {t(`tripLog_${entry.type}`)} ·{' '}
        <time dateTime={entry.timestamp}>
          {new Date(entry.timestamp).toLocaleString(language, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </p>
      {entry.notes && (
        <p className="m-0 whitespace-pre-wrap break-words text-sm text-slate-800">
          {entry.notes}
        </p>
      )}
      {entry.legacyMedia.map((item) => (
        <div
          key={item.id}
          className="w-72 max-w-full overflow-hidden rounded-xl"
        >
          {item.kind === 'voice' ? (
            <audio
              aria-label={t('tripLog_VOICE_NOTE')}
              src={apiUrl(item.url)}
              controls
              preload="none"
              className="w-full"
            />
          ) : item.kind === 'video' ? (
            <video
              aria-label={t('tripLog_MEDIA')}
              src={apiUrl(item.url)}
              controls
              playsInline
              preload="none"
              className="max-h-96 w-full"
            />
          ) : (
            <img
              src={apiUrl(item.url)}
              alt={t('tripLog_PHOTO')}
              loading="lazy"
              className="max-h-96 w-full object-contain"
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function TripChatLogItem({
  message,
  userId,
}: {
  message: ChatMessage
  userId: string
}) {
  if (!message.logEntry) return null
  const tripId = tripChatThreadTripId(message.threadId)
  return (
    <div
      className="mx-auto max-w-sm py-2 text-center"
      data-testid="trip-log-row"
    >
      <TripLogContent entry={message.logEntry} tripId={tripId} />
      <MessageMedia
        userId={userId}
        threadId={message.threadId}
        media={message.media}
      />
    </div>
  )
}
