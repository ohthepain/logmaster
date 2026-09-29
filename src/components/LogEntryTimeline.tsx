import {
  Anchor,
  Camera,
  Clock3,
  FileText,
  Flag,
  Mic,
  Sailboat,
  Settings2,
  Ship,
  Video,
} from 'lucide-react'
import type { LogEntry, LogEntryType, Media } from '../domain/logbook'
import { isVideoMediaData } from '../domain/logbook'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import { entryPlaceFromData } from '../lib/logbook-place'
import { SetTripCoverButton } from './SetTripCoverButton'

const icons: Record<LogEntryType, typeof Sailboat> = {
  START_TRIP: Sailboat,
  SAILS_UP: Sailboat,
  SAILS_DOWN: Sailboat,
  ENGINE_ON: Settings2,
  ENGINE_OFF: Settings2,
  ANCHOR_DROPPED: Anchor,
  ANCHOR_WEIGHED: Anchor,
  MOORED: Ship,
  CAST_OFF: Ship,
  END_TRIP: Flag,
  NOTE: FileText,
  HOURLY_LOG: Clock3,
  PHOTO: Camera,
  VOICE_NOTE: Mic,
  MEDIA: Camera,
}

export function LogEntryTimeline({
  entries,
  mediaByEntry,
  onOpenEntry,
}: {
  entries: LogEntry[]
  mediaByEntry: Map<string, Media[]>
  onOpenEntry: (entryId: string) => void
}) {
  const { t, language } = useTranslation()
  return (
    <ol className="m-0 list-none p-0">
      {entries.map((entry, index) => {
        const date = new Date(entry.timestamp)
        const previous = entries[index - 1]
        const showDate =
          !previous ||
          new Date(previous.timestamp).toDateString() !== date.toDateString()
        const Icon =
          entry.type === 'MEDIA' && isVideoMediaData(entry.data)
            ? Video
            : icons[entry.type]
        const preview = mediaByEntry
          .get(entry.id)
          ?.find((item) => item.thumbnailUrl)?.thumbnailUrl
        const detail = entry.notes || entryPlaceFromData(entry.data)?.name
        return (
          <li key={entry.id} className="relative">
            {index < entries.length - 1 && (
              <span
                className="absolute bottom-0 left-[5px] top-5 w-px bg-[var(--line)]"
                aria-hidden
              />
            )}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpenEntry(entry.id)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onOpenEntry(entry.id)
              }}
              className="ios-map-touch-target relative grid min-h-16 w-full touch-manipulation grid-cols-[12px_48px_24px_minmax(0,1fr)] items-start gap-x-3 rounded-lg py-3 text-left transition hover:bg-[var(--panel)] focus-visible:outline-2 focus-visible:outline-teal-600 sm:gap-x-4"
            >
              <span
                className={cn(
                  'relative mt-1.5 size-[11px] rounded-full ring-4 ring-[var(--surface-strong)]',
                  index === 0 ? 'bg-teal-500' : 'bg-[var(--sea-ink-soft)]/35',
                )}
                aria-hidden
              />
              <time
                dateTime={entry.timestamp}
                className="pt-0.5 text-xs tabular-nums text-[var(--sea-ink-soft)]"
                title={date.toLocaleString(language)}
              >
                {date.toLocaleTimeString(language, {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
                {showDate && (
                  <span className="mt-1 block text-[10px]">
                    {date.toLocaleDateString(language, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                )}
              </time>
              <Icon
                className="mt-0.5 size-6 text-[var(--sea-ink)]"
                strokeWidth={1.7}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-6 text-[var(--sea-ink)]">
                  {t(`tripLog_${entry.type}`)}
                </span>
                {detail && (
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[var(--sea-ink-soft)]">
                    {detail}
                  </span>
                )}
                {!entry.synced && (
                  <span className="mt-1 block text-[10px] text-[var(--sea-ink-soft)]">
                    Not synced
                  </span>
                )}
                {preview && (
                  <span className="mt-2 block w-32">
                    <img
                      src={preview}
                      alt=""
                      draggable={false}
                      className="max-h-32 w-32 rounded-xl object-cover"
                    />
                    <span className="mt-1 flex justify-end">
                      <SetTripCoverButton
                        tripId={entry.tripId}
                        source={async () => preview}
                      />
                    </span>
                  </span>
                )}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
