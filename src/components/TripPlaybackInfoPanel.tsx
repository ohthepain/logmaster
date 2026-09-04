import { Info, Pause, Play, Square } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { requestIosMapTouchSync } from '../lib/native/ios-map-touch-passthrough'
import type { LogEntry } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { cn } from '../lib/cn'
import type { TripPlaybackPosition } from '../lib/trip-playback'
import { tripPlaybackInfoAt, tripPlaybackAvailableTrackLabels } from '../lib/trip-playback-info'
import {
  PLAYBACK_SPEEDS,
  PlaybackSpeedControl,
  type PlaybackSpeed,
} from './PlaybackSpeedControl'
import { TripMapChromeButton } from './TripMapChromeButton'

type TripPlaybackInfoPanelRetrip = {
  timescale: number
  paused: boolean
  onPauseToggle: () => void
  onTimescaleChange: (timescale: number) => void
  onStop: () => void
}

type TripPlaybackInfoPanelProps = {
  tripId: string
  tracks: TripTrack[]
  entries: LogEntry[]
  currentTimeMs: number
  playbackPosition: TripPlaybackPosition | null
  retrip?: TripPlaybackInfoPanelRetrip
}

function retripSpeedIndex(timescale: number) {
  const exact = PLAYBACK_SPEEDS.indexOf(timescale as PlaybackSpeed)
  if (exact >= 0) return exact
  let best = 0
  let bestDiff = Number.POSITIVE_INFINITY
  for (let index = 0; index < PLAYBACK_SPEEDS.length; index += 1) {
    const diff = Math.abs(PLAYBACK_SPEEDS[index] - timescale)
    if (diff < bestDiff) {
      best = index
      bestDiff = diff
    }
  }
  return best
}

export function TripPlaybackInfoPanel({
  tripId,
  tracks,
  entries,
  currentTimeMs,
  playbackPosition,
  retrip,
}: TripPlaybackInfoPanelProps) {
  const [open, setOpen] = useState(false)
  const retripSpeedIndexValue = retrip ? retripSpeedIndex(retrip.timescale) : 0

  useEffect(() => {
    if (retrip) setOpen(true)
  }, [retrip])

  useEffect(() => {
    if (!open) return
    requestIosMapTouchSync()
  }, [open, retrip?.timescale])
  const availableTracks = useMemo(
    () => (retrip ? tripPlaybackAvailableTrackLabels(tripId, tracks) : []),
    [retrip, tracks, tripId],
  )
  const snapshot = useMemo(
    () =>
      tripPlaybackInfoAt(
        tripId,
        tracks,
        entries,
        currentTimeMs,
        playbackPosition,
      ),
    [currentTimeMs, entries, playbackPosition, tracks, tripId],
  )

  return (
    <div
      className="ios-map-touch-target pointer-events-auto flex flex-col items-start gap-2"
      data-map-touch-zone
    >
      <TripMapChromeButton
        label={open ? 'Hide trip info' : 'Show trip info'}
        onClick={() => setOpen((value) => !value)}
        active={open}
        tooltipSide="bottom"
      >
        <Info className="size-4" strokeWidth={2.25} />
      </TripMapChromeButton>

      {open ? (
        <div
          className={cn(
            'max-w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-black/60 text-white shadow-lg backdrop-blur-[2px]',
            retrip ? 'overflow-visible' : 'overflow-hidden',
            snapshot.lines.length > 0 ? 'bg-black/15' : 'bg-black/20',
          )}
          aria-live="polite"
          data-map-touch-zone
        >
          {retrip ? (
            <div
              className="ios-map-touch-target flex flex-wrap items-center gap-2 overflow-visible border-b border-red-900/50 bg-red-700/90 px-3 py-2"
              data-map-touch-zone
            >
              <span className="text-sm font-semibold uppercase tracking-wide">
                {retrip.paused ? 'Spoof armed' : 'Spoofing'}
              </span>
              <PlaybackSpeedControl
                speedIndex={retripSpeedIndexValue}
                menuPlacement="below"
                onSpeedIndexChange={(index) =>
                  retrip.onTimescaleChange(PLAYBACK_SPEEDS[index] ?? 1)
                }
              />
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={retrip.onPauseToggle}
                  className="ios-map-touch-target touch-manipulation inline-flex size-7 items-center justify-center rounded-lg bg-white/15 transition hover:bg-white/25"
                  data-map-touch-zone
                  aria-label={
                    retrip.paused ? 'Start spoof playback' : 'Pause spoofing'
                  }
                >
                  {retrip.paused ? (
                    <Play className="size-3.5" fill="currentColor" />
                  ) : (
                    <Pause className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={retrip.onStop}
                  className="ios-map-touch-target touch-manipulation inline-flex size-7 items-center justify-center rounded-lg bg-white/15 transition hover:bg-white/25"
                  data-map-touch-zone
                  aria-label="Stop spoofing"
                >
                  <Square className="size-3.5" fill="currentColor" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="px-3 py-2.5">
            {retrip?.paused && availableTracks.length > 0 ? (
              <p className="m-0 mb-2 text-xs leading-5 text-white/70">
                Tracks: {availableTracks.join(', ')}. Press play when ready.
              </p>
            ) : null}
            {snapshot.lines.length > 0 ? (
              <dl className="m-0 space-y-1.5">
                {snapshot.lines.map((line) => (
                  <div key={line.label} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                    <dt className="m-0 font-medium text-white/70">{line.label}</dt>
                    <dd className="m-0 font-semibold tabular-nums">{line.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="m-0 text-sm text-white/75">No data at this point.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
