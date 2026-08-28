import type { LogEntry, Media } from '../domain/logbook'
import { entryTitle } from '../domain/logbook'
import { formatDateTime } from '../lib/logbook-format'
import { LogEntryMapMarkerTooltip } from './LogEntryMapMarkerTooltip'
import { cn } from '../lib/cn'

type LogEntryMapMarkerHoverTargetProps = {
  entry: LogEntry
  media?: Media[]
  x: number
  y: number
  className?: string
  onSelect?: (entryId: string) => void
  onMediaClick?: (entryId: string, media: Media) => void
  pinned?: boolean
  onDismiss?: () => void
}

export function LogEntryMapMarkerHoverTarget({
  entry,
  media = [],
  x,
  y,
  className,
  onSelect,
  onMediaClick,
  pinned = false,
  onDismiss,
}: LogEntryMapMarkerHoverTargetProps) {
  return (
    <div
      className={cn('absolute z-20 -translate-x-1/2 -translate-y-1/2', className)}
      style={{ left: x, top: y }}
    >
      <div className="group relative size-9">
        <button
          type="button"
          onClick={() => onSelect?.(entry.id)}
          className="size-full rounded-full opacity-0 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label={`${entryTitle(entry.type)} ${formatDateTime(entry.timestamp)}`}
        />
        <div
          className={cn(
            'pointer-events-none absolute bottom-[calc(100%+0.35rem)] left-1/2 -translate-x-1/2',
            pinned
              ? 'pointer-events-auto opacity-100'
              : 'opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
          )}
        >
          <LogEntryMapMarkerTooltip
            entry={entry}
            media={media}
            onMediaClick={(item) => onMediaClick?.(entry.id, item)}
          />
          {pinned && onDismiss ? (
            <button
              type="button"
              data-map-touch-zone
              onClick={onDismiss}
              className="ios-map-touch-target pointer-events-auto mt-1 w-full rounded-md border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/80"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export type MapEntryPreviewState = {
  entryId: string
  x: number
  y: number
  pinned: boolean
}
