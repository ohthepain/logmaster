import { Check, Layers } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogEntry } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { cn } from '../lib/cn'
import type { TripPlaybackRange } from '../lib/trip-playback'
import {
  availablePlaybackPanels,
  buildPlaybackGraphSeries,
  countEnabledPlaybackViews,
  defaultPlaybackViewState,
  enabledGraphPlaybackPanelIds,
  sanitizePlaybackViewState,
  type PlaybackPanelId,
  type PlaybackPanelOption,
  type PlaybackViewState,
} from '../lib/trip-playback-panels'
import { TripPlaybackMultiGraph } from './TripPlaybackMultiGraph'

type TripPlaybackInstrumentGraphProps = {
  tripId: string
  tracks: TripTrack[]
  enabledGraphPanelIds: PlaybackPanelId[]
  windowRange: TripPlaybackRange
  currentTimeMs: number
}

export function TripPlaybackInstrumentGraph({
  tripId,
  tracks,
  enabledGraphPanelIds,
  windowRange,
  currentTimeMs,
}: TripPlaybackInstrumentGraphProps) {
  const series = useMemo(
    () => buildPlaybackGraphSeries(enabledGraphPanelIds, tripId, tracks),
    [enabledGraphPanelIds, tracks, tripId],
  )

  if (series.length === 0) {
    return (
      <p className="m-0 py-2 text-sm text-white/60">No graph data for selected tracks.</p>
    )
  }

  return (
    <TripPlaybackMultiGraph
      series={series}
      windowRange={windowRange}
      currentTimeMs={currentTimeMs}
    />
  )
}

type TripPlaybackViewSelectorProps = {
  options: PlaybackPanelOption[]
  viewState: PlaybackViewState
  onToggle: (panelId: PlaybackPanelId) => void
}

export function TripPlaybackViewSelector({
  options,
  viewState,
  onToggle,
}: TripPlaybackViewSelectorProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const enabledCount = countEnabledPlaybackViews(viewState)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (options.length === 0) return null

  return (
    <div ref={rootRef} className="relative justify-self-end">
      <button
        type="button"
        data-playback-control
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-white/15"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Timeline tracks"
        title="Timeline tracks"
      >
        <Layers className="size-3.5" />
        {enabledCount > 0 ? enabledCount : 'Tracks'}
      </button>
      {open ? (
        <div
          role="group"
          aria-label="Timeline tracks"
          className="absolute bottom-full right-0 z-40 mb-2 min-w-[13rem] overflow-hidden rounded-xl border border-white/15 bg-black/90 p-2 shadow-xl backdrop-blur-md"
        >
          <p className="m-0 px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
            Show on timeline
          </p>
          <div className="space-y-1">
            {options.map((option) => {
              const checked = viewState[option.id] ?? false
              const disabled = option.disabled === true
              return (
                <button
                  key={option.id}
                  type="button"
                  data-playback-control
                  disabled={disabled}
                  onClick={() => onToggle(option.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition',
                    disabled
                      ? 'cursor-not-allowed text-white/35'
                      : checked
                        ? 'bg-white/15 text-white'
                        : 'text-white/80 hover:bg-white/10',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-4 shrink-0 items-center justify-center rounded border',
                      checked
                        ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                        : 'border-white/30 bg-transparent',
                    )}
                    aria-hidden
                  >
                    {checked ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">{option.label}</span>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-white/45">
                    {option.shortLabel}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function usePlaybackViewState(
  tripId: string,
  tracks: TripTrack[],
  entries: LogEntry[],
) {
  const options = useMemo(
    () => availablePlaybackPanels(tripId, tracks, entries),
    [entries, tracks, tripId],
  )
  const [viewState, setViewState] = useState<PlaybackViewState>(() =>
    defaultPlaybackViewState(options),
  )

  useEffect(() => {
    setViewState((current) => sanitizePlaybackViewState(current, options))
  }, [options])

  const togglePanel = (panelId: PlaybackPanelId) => {
    const option = options.find((item) => item.id === panelId)
    if (option?.disabled) return

    setViewState((current) => {
      const sanitized = sanitizePlaybackViewState(current, options)
      const next = { ...sanitized, [panelId]: !sanitized[panelId] }
      if (!Object.values(next).some(Boolean)) {
        return sanitized
      }
      return next
    })
  }

  const showTimelineEntries = viewState['log-entries'] ?? false
  const enabledGraphPanelIds = useMemo(
    () => enabledGraphPlaybackPanelIds(viewState),
    [viewState],
  )
  const showInstrumentGraph = enabledGraphPanelIds.length > 0

  return {
    options,
    viewState,
    togglePanel,
    showTimelineEntries,
    enabledGraphPanelIds,
    showInstrumentGraph,
  }
}
