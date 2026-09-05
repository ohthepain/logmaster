import { useEffect, useState } from 'react'
import type { LogEntry } from '../domain/logbook'
import {
  logEntryMapIconKind,
  logEntryMapOutline,
} from '../lib/log-entry-map-marker'
import {
  logEntryMapMarkerDisplaySize,
  renderLogEntryMapMarkerDataUrl,
} from '../lib/map-log-entry-icons'

type PlaybackTimelineLogEntryMarkerProps = {
  entry: LogEntry
  legColor: string
  className?: string
}

export function PlaybackTimelineLogEntryMarker({
  entry,
  legColor,
  className,
}: PlaybackTimelineLogEntryMarkerProps) {
  const kind = logEntryMapIconKind(entry)
  const outline = logEntryMapOutline(entry)
  const displaySize = logEntryMapMarkerDisplaySize(kind)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void renderLogEntryMapMarkerDataUrl(kind, legColor, outline).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [kind, legColor, outline])

  if (!src) {
    return (
      <span
        className={className}
        style={{ width: displaySize, height: displaySize }}
        aria-hidden
      />
    )
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      style={{ width: displaySize, height: displaySize }}
      draggable={false}
    />
  )
}
