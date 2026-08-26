import { Pencil, Sailboat } from 'lucide-react'
import { useRef } from 'react'
import type { Leg, LogEntry, Trip } from '../domain/logbook'
import type { TripDetailCoverDisplay } from '../lib/trip-display'
import { getNativePlatform } from '../lib/platform'
import { DevComponentLabel } from './DevComponentLabel'
import { SailingMapControlStack } from './SailingMapControlStack'
import { TripLogMap } from './TripLogMap'
import type { TripAppleMapKitHandle } from './TripAppleMapKit'
import { TripOperationalStatus } from './TripOperationalStatus'

type TripDetailHeroProps = {
  trip: Trip
  cover: TripDetailCoverDisplay
  mapEntries: LogEntry[]
  mapLegs: Leg[]
  busy: boolean
  onEditCoverClick: () => void
  onLogEntryClick?: () => void
}

export function TripDetailHero({
  trip,
  cover,
  mapEntries,
  mapLegs,
  busy,
  onEditCoverClick,
  onLogEntryClick,
}: TripDetailHeroProps) {
  const isActiveTrip = trip.status === 'IN_PROGRESS' || trip.status === 'PLANNED'
  const showInteractiveMap = isActiveTrip || cover.kind === 'map'
  const showPhoto = !showInteractiveMap && cover.kind === 'photo' && cover.photoUrl
  const showOperationalOverlay = showInteractiveMap
  const useExternalIosMapControls =
    getNativePlatform() === 'ios' && showInteractiveMap && isActiveTrip
  const mapRef = useRef<TripAppleMapKitHandle>(null)

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
            mapClassName="absolute inset-0 size-full"
            allowFullscreen={isActiveTrip}
            showControls={isActiveTrip && !useExternalIosMapControls}
            showCurrentPosition={isActiveTrip}
            interactive={isActiveTrip}
            embedded
            showSeamarks={isActiveTrip}
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
          onLocate={() => mapRef.current?.locate()}
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

      <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-start px-3 sm:px-4">
        <button
          type="button"
          onClick={onEditCoverClick}
          disabled={busy}
          className="ios-map-touch-target pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/45 disabled:opacity-60"
          aria-label="Edit trip cover"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </section>
  )
}
