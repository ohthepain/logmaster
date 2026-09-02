import { Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LogEntry } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { cn } from '../lib/cn'
import type { TripPlaybackPosition } from '../lib/trip-playback'
import { tripPlaybackInfoAt } from '../lib/trip-playback-info'
import { TripMapChromeButton } from './TripMapChromeButton'

type TripPlaybackInfoPanelProps = {
  tripId: string
  tracks: TripTrack[]
  entries: LogEntry[]
  currentTimeMs: number
  playbackPosition: TripPlaybackPosition | null
}

export function TripPlaybackInfoPanel({
  tripId,
  tracks,
  entries,
  currentTimeMs,
  playbackPosition,
}: TripPlaybackInfoPanelProps) {
  const [open, setOpen] = useState(false)
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
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      <TripMapChromeButton
        label={open ? 'Hide playback info' : 'Show playback info'}
        onClick={() => setOpen((value) => !value)}
        active={open}
        tooltipSide="bottom"
      >
        <Info className="size-4" strokeWidth={2.25} />
      </TripMapChromeButton>

      {open ? (
        <div
          className={cn(
            'max-w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-black/60 px-3 py-2.5 text-white shadow-lg backdrop-blur-[2px]',
            snapshot.lines.length > 0 ? 'bg-black/15' : 'bg-black/20',
          )}
          aria-live="polite"
        >
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
      ) : null}
    </div>
  )
}
