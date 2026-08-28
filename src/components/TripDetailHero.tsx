import { List, Map, Pencil, RotateCw, Sailboat } from 'lucide-react'
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
import { TripMapChromeButton } from './TripMapChromeButton'
import { tripPlaybackPositionAt, tripPlaybackRange } from '../lib/trip-playback'

export type CompletedTripPanel = 'map' | 'log'

type TripDetailHeroProps = {
  trip: Trip
  cover: TripDetailCoverDisplay
  mapEntries: LogEntry[]
  mapLegs: Leg[]
  mediaByEntry: Map<string, Media[]>
  busy: boolean
  selectedEntryId?: string | null
  onEntrySelect?: (entryId: string) => void
  completedTripPanel?: CompletedTripPanel
  onCompletedTripPanelChange?: (panel: CompletedTripPanel) => void
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
  completedTripPanel = 'map',
  onCompletedTripPanelChange,
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

  const showPlaybackOverlay = isPlayback && completedTripPanel === 'map'

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
            mediaByEntry={mediaByEntry}
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

      {showPlaybackOverlay ? (
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
        <TripMapChromeButton
          label="Edit trip cover"
          onClick={onEditCoverClick}
          disabled={busy}
          tooltipSide="bottom"
        >
          <Pencil className="size-4" />
        </TripMapChromeButton>
        {isPlayback && onCompletedTripPanelChange ? (
          completedTripPanel === 'map' ? (
            <TripMapChromeButton
              label="Log entries"
              onClick={() => onCompletedTripPanelChange('log')}
              disabled={busy}
              tooltipSide="bottom"
            >
              <List className="size-4" />
            </TripMapChromeButton>
          ) : (
            <TripMapChromeButton
              label="Map & playback"
              onClick={() => onCompletedTripPanelChange('map')}
              disabled={busy}
              active
              tooltipSide="bottom"
            >
              <Map className="size-4" />
            </TripMapChromeButton>
          )
        ) : null}
        {onReplayTestClick ? (
          <TripMapChromeButton
            label="Start auto-test replay"
            onClick={onReplayTestClick}
            disabled={busy}
            tooltipSide="bottom"
          >
            <RotateCw className="size-4" />
          </TripMapChromeButton>
        ) : null}
      </div>
    </section>
  )
}
