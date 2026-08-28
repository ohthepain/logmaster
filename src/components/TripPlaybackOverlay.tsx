import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { entryIcon, entryTitle } from '../domain/logbook'
import type { LogEntry, Media, Trip } from '../domain/logbook'
import { formatDateTime } from '../lib/logbook-format'
import { compareLogEntriesChronologically } from '../lib/logbook-entry-order'
import { isVideoLogEntry } from '../lib/log-entry-map-marker'
import {
  tripPlaybackRange,
  tripPlaybackWindow,
} from '../lib/trip-playback'
import { cn } from '../lib/cn'

const MAX_TIME_ZOOM = 16
const PRESENTATION_LENGTH_MS = 120_000
const SPEEDS = [0.5, 1, 2, 4] as const

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startTimeMs: number
  startZoom: number
  windowDurationMs: number
}

const DRAG_ACTIVATION_PX = 5
const ZOOM_DRAG_PX = 6
const SCRUB_DRAG_PX = 6

type TripPlaybackOverlayProps = {
  trip: Trip
  entries: LogEntry[]
  mediaByEntry: Map<string, Media[]>
  currentTimeMs: number
  onCurrentTimeChange: (timeMs: number) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isVideoMedia(entry: LogEntry, media: Media[]) {
  if (isVideoLogEntry(entry)) return true
  return media.some((item) =>
    /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(item.remoteUrl ?? item.localPath ?? ''),
  )
}

function mediaSource(media: Media[]) {
  for (const item of media) {
    const source = item.remoteUrl ?? item.thumbnailUrl
    if (source) return source
  }
  return null
}

function formatClock(timeMs: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timeMs))
}

function formatDuration(durationMs: number) {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes.toString().padStart(2, '0')}m` : `${minutes}m`
}

export function TripPlaybackOverlay({
  trip,
  entries,
  mediaByEntry,
  currentTimeMs,
  onCurrentTimeChange,
}: TripPlaybackOverlayProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const chronologicalEntries = useMemo(
    () => [...entries].filter((entry) => !entry.deleted).sort(compareLogEntriesChronologically),
    [entries],
  )
  const range = useMemo(
    () => tripPlaybackRange(trip, chronologicalEntries),
    [chronologicalEntries, trip],
  )
  const [timeZoom, setTimeZoom] = useState(1)
  const [windowCenterMs, setWindowCenterMs] = useState(currentTimeMs)
  const [playing, setPlaying] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(1)
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const [mediaEntryId, setMediaEntryId] = useState<string | null>(null)
  const [mediaPinned, setMediaPinned] = useState(false)
  const windowRange = tripPlaybackWindow(range, windowCenterMs, timeZoom)
  const currentPercent = clamp(
    ((currentTimeMs - windowRange.startMs) / windowRange.durationMs) * 100,
    0,
    100,
  )
  const activeEntry = chronologicalEntries.find((entry) => entry.id === activeEntryId) ?? null
  const mediaEntry = chronologicalEntries.find((entry) => entry.id === mediaEntryId) ?? null
  const mediaItems = mediaEntry ? mediaByEntry.get(mediaEntry.id) ?? [] : []
  const mediaIsVideo = mediaEntry ? isVideoMedia(mediaEntry, mediaItems) : false
  const fullMediaSource = mediaSource(mediaItems)
  const videoSource = mediaIsVideo
    ? mediaItems.find((item) => item.remoteUrl)?.remoteUrl ?? null
    : null
  const mediaThumbnail =
    mediaItems.find((item) => item.thumbnailUrl)?.thumbnailUrl ??
    (mediaIsVideo ? null : mediaSource(mediaItems))

  useEffect(() => {
    onCurrentTimeChange(clamp(currentTimeMs, range.startMs, range.endMs))
  }, [currentTimeMs, onCurrentTimeChange, range.endMs, range.startMs])

  useEffect(() => {
    if (!playing) return
    let animationFrame = 0
    let previousFrame = performance.now()
    const tripMsPerRealMs =
      range.durationMs / (PRESENTATION_LENGTH_MS / SPEEDS[speedIndex])

    const animate = (now: number) => {
      const elapsed = now - previousFrame
      previousFrame = now
      const next = Math.min(range.endMs, currentTimeMs + elapsed * tripMsPerRealMs)
      onCurrentTimeChange(next)
      setWindowCenterMs(next)
      if (next >= range.endMs) {
        setPlaying(false)
        return
      }
      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [currentTimeMs, onCurrentTimeChange, playing, range.durationMs, range.endMs, speedIndex])

  const updateEntryAtTime = (timeMs: number, thresholdMs: number) => {
    let nearest: LogEntry | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const entry of chronologicalEntries) {
      const distance = Math.abs(new Date(entry.timestamp).getTime() - timeMs)
      if (distance < nearestDistance) {
        nearest = entry
        nearestDistance = distance
      }
    }
    if (!nearest || nearestDistance > thresholdMs) {
      setActiveEntryId(null)
      if (!mediaPinned) setMediaEntryId(null)
      return
    }

    setActiveEntryId(nearest.id)
    const media = mediaByEntry.get(nearest.id) ?? []
    if (media.length > 0 || isVideoLogEntry(nearest)) {
      setMediaEntryId(nearest.id)
      setMediaPinned(false)
    } else if (!mediaPinned) {
      setMediaEntryId(null)
    }
  }

  const setTimeFromClientX = (clientX: number, drag: DragState) => {
    const node = timelineRef.current
    if (!node) return
    const width = Math.max(1, node.getBoundingClientRect().width)
    const delta = ((clientX - drag.startX) / width) * drag.windowDurationMs
    const next = clamp(drag.startTimeMs + delta, range.startMs, range.endMs)
    onCurrentTimeChange(next)
    const visible = tripPlaybackWindow(range, windowCenterMs, timeZoom)
    const visiblePercent = (next - visible.startMs) / visible.durationMs
    if (visiblePercent < 0.12 || visiblePercent > 0.88) setWindowCenterMs(next)
    updateEntryAtTime(next, (visible.durationMs / width) * 28)
  }

  const moveToEntry = (entry: LogEntry) => {
    const timeMs = clamp(new Date(entry.timestamp).getTime(), range.startMs, range.endMs)
    setPlaying(false)
    onCurrentTimeChange(timeMs)
    setWindowCenterMs(timeMs)
    setActiveEntryId(entry.id)
  }

  const skipEntry = (direction: -1 | 1) => {
    const candidates =
      direction < 0
        ? [...chronologicalEntries].reverse().filter((entry) => new Date(entry.timestamp).getTime() < currentTimeMs)
        : chronologicalEntries.filter((entry) => new Date(entry.timestamp).getTime() > currentTimeMs)
    const target = candidates[0] ?? chronologicalEntries[direction < 0 ? 0 : chronologicalEntries.length - 1]
    if (target) moveToEntry(target)
  }

  const openEntryMedia = (entry: LogEntry) => {
    moveToEntry(entry)
    setMediaEntryId(entry.id)
    setMediaPinned(true)
  }

  const closeMedia = () => {
    setMediaEntryId(null)
    setMediaPinned(false)
  }

  return (
    <>
      {mediaEntry ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/80">
          {mediaIsVideo ? (
            videoSource ? (
              <video
                key={videoSource}
                src={videoSource}
                poster={mediaThumbnail ?? undefined}
                controls={mediaPinned}
                playsInline
                className={cn('max-h-full max-w-full object-contain', mediaPinned && 'pointer-events-auto')}
              />
            ) : mediaThumbnail ? (
              <div className="relative flex size-full items-center justify-center">
                <img src={mediaThumbnail} alt="" className="max-h-full max-w-full object-contain" />
                <Play className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-lg" fill="currentColor" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-white">
                <Play className="size-14" fill="currentColor" />
                <p className="m-0 text-sm font-semibold">Video unavailable on this device</p>
              </div>
            )
          ) : fullMediaSource ? (
            <img src={fullMediaSource} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white">
              <p className="m-0 text-sm font-semibold">Media unavailable on this device</p>
            </div>
          )}
          {mediaPinned ? (
            <button
              type="button"
              data-map-touch-zone
              onClick={closeMedia}
              className="ios-map-touch-target pointer-events-auto absolute right-3 top-24 inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-sm"
              aria-label="Close media"
            >
              <X className="size-5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {activeEntry ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-[calc(12.75rem+env(safe-area-inset-bottom,0px))] z-30 flex justify-center">
          <div className="max-w-md rounded-2xl border border-white/25 bg-black/65 px-4 py-3 text-white shadow-xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <span className="text-xl" aria-hidden>{entryIcon(activeEntry.type)}</span>
              <div className="min-w-0">
                <p className="m-0 text-sm font-bold">{entryTitle(activeEntry.type)}</p>
                <p className="m-0 mt-0.5 text-xs text-white/70">{formatDateTime(activeEntry.timestamp)}</p>
                {activeEntry.notes ? <p className="m-0 mt-1 line-clamp-2 text-sm">{activeEntry.notes}</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section
        data-map-touch-zone
        aria-label="Trip playback"
        className="ios-map-touch-target pointer-events-auto absolute inset-x-0 bottom-0 z-30 border-t border-white/25 bg-black/65 px-3 pt-3 text-white shadow-[0_-12px_36px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:px-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}
      >
        <div className="mx-auto max-w-4xl">
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-white/75">
            <span>{formatClock(currentTimeMs)}</span>
            <span>{formatDuration(Math.max(0, currentTimeMs - range.startMs))} / {formatDuration(range.durationMs)}</span>
            <span>Time zoom {timeZoom.toFixed(timeZoom < 2 ? 1 : 0)}×</span>
          </div>

          <div
            ref={timelineRef}
            className="relative h-[76px] touch-none select-none"
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest('button')) return
              event.currentTarget.setPointerCapture(event.pointerId)
              dragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startTimeMs: currentTimeMs,
                startZoom: timeZoom,
                windowDurationMs: windowRange.durationMs,
              }
              setPlaying(false)
              setMediaPinned(false)
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current
              if (!drag || drag.pointerId !== event.pointerId) return
              const dx = event.clientX - drag.startX
              const dy = event.clientY - drag.startY
              if (Math.abs(dx) >= SCRUB_DRAG_PX) {
                setTimeFromClientX(event.clientX, drag)
              }
              if (Math.abs(dy) >= ZOOM_DRAG_PX) {
                const nextZoom = clamp(drag.startZoom * Math.exp(-dy / 288), 1, MAX_TIME_ZOOM)
                setTimeZoom(nextZoom)
                setWindowCenterMs(currentTimeMs)
              }
            }}
            onPointerUp={(event) => {
              const drag = dragRef.current
              if (!drag || drag.pointerId !== event.pointerId) return
              event.currentTarget.releasePointerCapture(event.pointerId)
              const dx = event.clientX - drag.startX
              const dy = event.clientY - drag.startY
              if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_ACTIVATION_PX) {
                setTimeFromClientX(event.clientX, drag)
              }
              const previewEntry = chronologicalEntries.find((entry) => entry.id === mediaEntryId)
              if (previewEntry && isVideoMedia(previewEntry, mediaByEntry.get(previewEntry.id) ?? [])) {
                setMediaPinned(true)
              } else {
                setMediaEntryId(null)
              }
              dragRef.current = null
            }}
            onPointerCancel={() => {
              dragRef.current = null
              if (!mediaPinned) setMediaEntryId(null)
            }}
          >
            <div className="absolute inset-x-0 top-[48px] h-1 rounded-full bg-white/25" />
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
              <div
                key={fraction}
                className="absolute top-[44px] h-3 w-px bg-white/50"
                style={{ left: `${fraction * 100}%` }}
              />
            ))}

            {chronologicalEntries.map((entry) => {
              const timeMs = new Date(entry.timestamp).getTime()
              if (timeMs < windowRange.startMs || timeMs > windowRange.endMs) return null
              const left = ((timeMs - windowRange.startMs) / windowRange.durationMs) * 100
              const media = mediaByEntry.get(entry.id) ?? []
              const entryIsVideo = isVideoMedia(entry, media)
              const thumbnail =
                media.find((item) => item.thumbnailUrl)?.thumbnailUrl ??
                (entryIsVideo ? null : mediaSource(media))
              const hasMedia = media.length > 0 || isVideoLogEntry(entry)
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (hasMedia) openEntryMedia(entry)
                    else moveToEntry(entry)
                  }}
                  className="absolute top-0 z-10 -translate-x-1/2 touch-manipulation"
                  style={{ left: `${left}%` }}
                  aria-label={`${entryTitle(entry.type)} at ${formatClock(timeMs)}`}
                >
                  {thumbnail ? (
                    <span className="relative block size-10 overflow-hidden rounded-lg border-2 border-white bg-black shadow-md">
                      <img src={thumbnail} alt="" className="size-full object-cover" />
                      {entryIsVideo ? (
                        <Play className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 drop-shadow" fill="currentColor" />
                      ) : null}
                    </span>
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full border border-white/40 bg-black/70 text-sm shadow-md">
                      {entryIcon(entry.type)}
                    </span>
                  )}
                  <span className="mx-auto block h-2 w-px bg-white/70" />
                </button>
              )
            })}

            <div
              className="pointer-events-none absolute inset-y-0 z-20 w-px bg-[var(--brand)] shadow-[0_0_8px_rgba(235,69,57,0.7)]"
              style={{ left: `${currentPercent}%` }}
            >
              <div className="absolute -bottom-0.5 left-1/2 flex h-7 w-5 -translate-x-1/2 items-center justify-center rounded-b-lg rounded-t-sm bg-[var(--brand)] shadow-lg">
                <span className="h-3 w-0.5 rounded-full bg-white/80" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPlaying(false)
                onCurrentTimeChange(range.startMs)
                setWindowCenterMs(range.startMs)
                setActiveEntryId(null)
              }}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Restart trip"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => skipEntry(-1)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Previous log entry"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentTimeMs >= range.endMs) {
                  onCurrentTimeChange(range.startMs)
                  setWindowCenterMs(range.startMs)
                }
                setPlaying((value) => !value)
              }}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-md hover:bg-white/90"
              aria-label={playing ? 'Pause trip' : 'Play trip'}
            >
              {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="ml-0.5 size-5" fill="currentColor" />}
            </button>
            <button
              type="button"
              onClick={() => skipEntry(1)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Next log entry"
            >
              <ChevronRight className="size-5" />
            </button>

            <label className="ml-1 flex min-w-0 flex-1 items-center gap-2 text-[11px] font-semibold text-white/75">
              <span className="shrink-0">{SPEEDS[speedIndex]}×</span>
              <input
                type="range"
                min={0}
                max={SPEEDS.length - 1}
                step={1}
                value={speedIndex}
                onChange={(event) => setSpeedIndex(Number(event.target.value))}
                className="min-w-0 flex-1 accent-[var(--brand)]"
                aria-label="Playback speed"
              />
            </label>
          </div>
        </div>
      </section>
    </>
  )
}
