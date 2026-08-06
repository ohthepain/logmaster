import { Link } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Sailboat } from 'lucide-react'
import type { Leg, LogEntry, Trip } from '../domain/logbook'
import type { TripDetailCoverDisplay } from '../lib/trip-display'
import { DevComponentLabel } from './DevComponentLabel'
import { TripLogMap } from './TripLogMap'

type TripDetailHeroProps = {
  trip: Trip
  cover: TripDetailCoverDisplay
  mapEntries: LogEntry[]
  mapLegs: Leg[]
  busy: boolean
  onEditCoverClick: () => void
}

export function TripDetailHero({
  trip,
  cover,
  mapEntries,
  mapLegs,
  busy,
  onEditCoverClick,
}: TripDetailHeroProps) {
  const isActiveTrip = trip.status === 'IN_PROGRESS' || trip.status === 'PLANNED'
  const showInteractiveMap = isActiveTrip || cover.kind === 'map'
  const showPhoto = !showInteractiveMap && cover.kind === 'photo' && cover.photoUrl

  return (
    <section className="relative isolate min-h-[min(28rem,72vh)] w-full overflow-hidden bg-[var(--chip-bg)]">
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

      <div className="pointer-events-none relative z-10 flex min-h-[min(28rem,72vh)] flex-col px-3 pt-3 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <Link
            to="/"
            className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm no-underline transition hover:bg-black/45"
            aria-label="Back to trips"
          >
            <ArrowLeft className="size-4" />
          </Link>

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
      </div>
    </section>
  )
}
