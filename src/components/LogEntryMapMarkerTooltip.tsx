import { Camera, Play } from 'lucide-react'
import type { LogEntry, Media } from '../domain/logbook'
import { entryTitle } from '../domain/logbook'
import { formatDateTime } from '../lib/logbook-format'
import { isVideoLogEntry } from '../lib/log-entry-map-marker'
import { cn } from '../lib/cn'

type LogEntryMapMarkerTooltipProps = {
  entry: LogEntry
  media?: Media[]
  className?: string
  onMediaClick?: (media: Media) => void
}

function isVideoMedia(entry: LogEntry, media: Media[]) {
  if (isVideoLogEntry(entry)) return true
  return media.some((item) =>
    /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(item.remoteUrl ?? item.localPath ?? ''),
  )
}

function mediaPreviewSource(media: Media) {
  return media.thumbnailUrl ?? media.remoteUrl ?? media.localPath ?? null
}

export function LogEntryMapMarkerTooltip({
  entry,
  media = [],
  className,
  onMediaClick,
}: LogEntryMapMarkerTooltipProps) {
  const videoItems = media.filter((item, index) => {
    const source = item.remoteUrl ?? item.localPath
    if (!source) return false
    if (index === 0 && isVideoMedia(entry, media)) return true
    return /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(source)
  })
  const photoItems = media.filter((item) => {
    const source = item.remoteUrl ?? item.localPath ?? item.thumbnailUrl
    if (!source) return false
    return !/\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(source)
  })

  return (
    <div
      className={cn(
        'min-w-[9.5rem] max-w-[12rem] rounded-lg border border-white/25 bg-black/80 px-2.5 py-2 text-white shadow-lg backdrop-blur-md',
        className,
      )}
    >
      <p className="m-0 text-[11px] font-semibold leading-tight">{entryTitle(entry.type)}</p>
      <p className="m-0 mt-0.5 text-[10px] text-white/70">{formatDateTime(entry.timestamp)}</p>
      {photoItems.length > 0 || videoItems.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {photoItems.map((item) => {
            const source = mediaPreviewSource(item)
            if (!source) return null
            return (
              <button
                key={item.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onMediaClick?.(item)
                }}
                className="relative size-7 overflow-hidden rounded border border-white/30 bg-black/40 transition hover:border-white/60"
                aria-label="Open photo"
              >
                <img src={source} alt="" className="size-full object-cover" />
                <Camera className="absolute bottom-0 right-0 size-2.5 text-white drop-shadow" />
              </button>
            )
          })}
          {videoItems.map((item) => {
            const source = mediaPreviewSource(item)
            return (
              <button
                key={item.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onMediaClick?.(item)
                }}
                className="relative flex size-7 items-center justify-center overflow-hidden rounded border border-white/30 bg-black/40 transition hover:border-white/60"
                aria-label="Open video"
              >
                {source ? (
                  <img src={source} alt="" className="size-full object-cover opacity-80" />
                ) : null}
                <Play className="absolute size-3 text-white drop-shadow" fill="currentColor" />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
