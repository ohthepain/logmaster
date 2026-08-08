import { Pencil, Sailboat } from 'lucide-react'
import type { Leg, LogEntry, Trip } from '../domain/logbook'
import type { TripDetailCoverDisplay } from '../lib/trip-display'
import { DevComponentLabel } from './DevComponentLabel'
import { TripLogMap } from './TripLogMap'
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
  const showOperationalOverlay = showInteractiveMap && trip.status !== 'PLANNED'

  return (
    <section className="absolute inset-0 isolate overflow-hidden bg-[var(--chip-bg)]">
      <DevComponentLabel name="TripDetailHero" className="absolute left-3 top-14 z-20 sm:left-4" />

      {showInteractiveMap ? (
        <div className="absolute inset-0">
          <TripLogMap
            trip={trip}
            entries={mapEntries}
            legs={mapLegs}
            mapClassName="absolute inset-0 size-full"
            allowFullscreen={isActiveTrip}
            showControls={isActiveTrip}
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

      {showOperationalOverlay ? (
        <TripOperationalStatus
          tripId={trip.id}
          trip={trip}
          entries={mapEntries}
          onLogEntryClick={onLogEntryClick}
          logEntryDisabled={busy}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-end px-3 pt-3 sm:px-4">
        <button
          type="button"
          onClick={onEditCoverClick}
          disabled={busy}
          className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/45 disabled:opacity-60"
          aria-label="Edit trip cover"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </section>
  )
}
