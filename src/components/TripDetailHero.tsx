import { Pencil, RotateCw, Sailboat } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Leg, LogEntry, Media, Trip } from '../domain/logbook'
import type { TripDetailCoverDisplay } from '../lib/trip-display'
import { getNativePlatform } from '../lib/platform'
import { useAppOptionsStore } from '../stores/app-options'
import { DevComponentLabel } from './DevComponentLabel'
import { SailingMapControlStack } from './SailingMapControlStack'
import { TripLogMap } from './TripLogMap'
import type { TripAppleMapKitHandle } from './TripAppleMapKit'
import { TripOperationalStatus } from './TripOperationalStatus'
import { TripPlaybackOverlay } from './TripPlaybackOverlay'
import { tripPlaybackPositionAt, tripPlaybackRange } from '../lib/trip-playback'

type TripDetailHeroProps = {
  trip: Trip
  cover: TripDetailCoverDisplay
  mapEntries: LogEntry[]
  mapLegs: Leg[]
  mediaByEntry: Map<string, Media[]>
  busy: boolean
  selectedEntryId?: string | null
  onEntrySelect?: (entryId: string) => void
  onEditCoverClick: () => void
  onLogEntryClick?: () => void
  onReplayTestClick?: () => void
}

export function TripDetailHero({
  trip,
  cover,
  mapEntries,
  mapLegs,
  mediaByEntry,
  busy,
  selectedEntryId = null,
  onEntrySelect,
  onEditCoverClick,
  onLogEntryClick,
  onReplayTestClick,
}: TripDetailHeroProps) {
  const isActiveTrip = trip.status === 'IN_PROGRESS' || trip.status === 'PLANNED'
  const isPlayback = trip.status === 'COMPLETED'
  const recordingTripId = useAppOptionsStore((state) => state.recordingTripId)
  const showCurrentPosition = isActiveTrip && recordingTripId === trip.id
  const showInteractiveMap = isActiveTrip || isPlayback || cover.kind === 'map'
  const showPhoto = !showInteractiveMap && cover.kind === 'photo' && cover.photoUrl
  const showOperationalOverlay = isActiveTrip
  const useExternalIosMapControls =
    getNativePlatform() === 'ios' && showInteractiveMap
  const mapRef = useRef<TripAppleMapKitHandle>(null)
  const playbackRange = useMemo(
    () => tripPlaybackRange(trip, mapEntries),
    [mapEntries, trip],
  )
  const [playbackTimeMs, setPlaybackTimeMs] = useState(playbackRange.startMs)
  const playbackPosition = useMemo(
    () => isPlayback ? tripPlaybackPositionAt(mapEntries, playbackTimeMs) : null,
    [isPlayback, mapEntries, playbackTimeMs],
  )

  useEffect(() => {
    setPlaybackTimeMs(playbackRange.startMs)
  }, [playbackRange.startMs, trip.id])

  return (
    <section
      className={
        getNativePlatform() === 'ios' && showInteractiveMap
          ? 'absolute inset-0 isolate overflow-hidden bg-transparent'
          : 'absolute inset-0 isolate overflow-hidden bg-[var(--chip-bg)]'
      }
    >
      <DevComponentLabel name="TripDetailHero" className="absolute left-3 top-14 z-20 sm:left-4" />

      {showInteractiveMap ? (
        <div className="absolute inset-0">
          <TripLogMap
            ref={mapRef}
            trip={trip}
            entries={mapEntries}
            legs={mapLegs}
            selectedEntryId={selectedEntryId}
            onEntrySelect={onEntrySelect}
            mapClassName="absolute inset-0 size-full"
            allowFullscreen={isActiveTrip}
            showControls={!useExternalIosMapControls}
            showCurrentPosition={showCurrentPosition}
            interactive={isActiveTrip || isPlayback}
            embedded
            showSeamarks={isActiveTrip}
            playbackPosition={playbackPosition}
            playbackMode={isPlayback}
          />
        </div>
      ) : showPhoto ? (
        <img src={cover.photoUrl!} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,#1e3a5f_0%,#0f172a_55%,#020617_100%)] text-white/35">
          <Sailboat className="size-24" strokeWidth={1.1} />
        </div>
      )}

      {showPhoto ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />
      ) : null}

      {useExternalIosMapControls ? (
        <SailingMapControlStack
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onLocate={isPlayback ? undefined : () => mapRef.current?.locate()}
        />
      ) : null}

      {isPlayback ? (
        <TripPlaybackOverlay
          trip={trip}
          entries={mapEntries}
          mediaByEntry={mediaByEntry}
          currentTimeMs={playbackTimeMs}
          onCurrentTimeChange={setPlaybackTimeMs}
        />
      ) : null}

      {showOperationalOverlay ? (
        <TripOperationalStatus
          tripId={trip.id}
          trip={trip}
          entries={mapEntries}
          onLogEntryClick={onLogEntryClick}
          logEntryDisabled={busy}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-start gap-2 px-3 sm:px-4">
        <button
          type="button"
          onClick={onEditCoverClick}
          disabled={busy}
          data-map-touch-zone
          className="ios-map-touch-target pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/45 disabled:opacity-60"
          aria-label="Edit trip cover"
        >
          <Pencil className="size-4" />
        </button>
        {onReplayTestClick ? (
          <button
            type="button"
            onClick={onReplayTestClick}
            disabled={busy}
            data-map-touch-zone
            className="ios-map-touch-target pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/45 disabled:opacity-60"
            aria-label="Start auto-test replay"
          >
            <RotateCw className="size-4" />
          </button>
        ) : null}
      </div>
    </section>
  )
}
