import { entryIcon, entryTitle } from '../domain/logbook'
import type { LogEntry, Media } from '../domain/logbook'
import {
  formatDateTime,
  formatWeather,
} from '../lib/logbook-format'
import { formatPositionDisplay, entryPlaceFromData } from '../lib/logbook-place'
import { cn } from '../lib/cn'
import { DevComponentLabel } from './DevComponentLabel'

type LogEntryCardProps = {
  entry: LogEntry
  media: Media[]
  onOpen: () => void
}

export function LogEntryCard({ entry, media, onOpen }: LogEntryCardProps) {
  return (
    <article
      className={cn(
        'relative rounded-[1.5rem] border p-4 shadow-sm transition',
        entry.deleted
          ? 'border-red-500/30 bg-red-500/5'
          : 'cursor-pointer border-[var(--panel-border)] bg-[var(--surface-strong)] hover:border-[var(--sea-ink)]/20',
      )}
    >
      <DevComponentLabel name="LogEntryCard" className="absolute left-3 top-3" />
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left"
        disabled={entry.deleted}
      >
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] text-xl">
            {entryIcon(entry.type)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
                  {entryTitle(entry.type)}
                </p>
                <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                  {formatDateTime(entry.timestamp)}
                  {entry.accuracy != null
                    ? ` · ±${Math.round(entry.accuracy)}m`
                    : ''}
                </p>
              </div>
              <SyncBadge synced={entry.synced} deleted={entry.deleted} />
            </div>

            <div className="mt-2 space-y-2 text-sm text-[var(--sea-ink)]">
              <p className="m-0">
                {formatPositionDisplay(
                  entry.latitude,
                  entry.longitude,
                  entryPlaceFromData(entry.data),
                )}
              </p>
              {entry.heading != null && (
                <p className="m-0">Heading {Math.round(entry.heading)}°</p>
              )}
              {entry.notes && <p className="m-0 line-clamp-2">{entry.notes}</p>}
              {entry.weather && (
                <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                  Weather: {formatWeather(entry.weather)}
                </p>
              )}
              {media.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {media.map((item) => (
                    <EntryBadge key={item.id}>
                      {item.type}
                      {item.localPath ? ` · ${item.localPath}` : ''}
                    </EntryBadge>
                  ))}
                </div>
              )}
              {media.some((item) => item.thumbnailUrl) && (
                <div className="flex flex-wrap gap-2">
                  {media
                    .filter((item) => item.thumbnailUrl)
                    .map((item) => (
                      <img
                        key={item.id}
                        src={item.thumbnailUrl ?? undefined}
                        alt=""
                        className="size-20 rounded-xl border border-[var(--line)] object-cover"
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </button>
    </article>
  )
}

function SyncBadge({ synced, deleted }: { synced: boolean; deleted: boolean }) {
  if (!deleted && synced) return null

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]',
        deleted
          ? 'bg-red-500/10 text-red-700 dark:text-red-300'
          : 'border border-[var(--line)] bg-[var(--panel)] text-[var(--sea-ink)]',
      )}
    >
      {deleted ? 'Deleted' : 'Not synced'}
    </span>
  )
}

function EntryBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2.5 py-1 text-xs font-medium text-[var(--sea-ink-soft)]">
      {children}
    </span>
  )
}
