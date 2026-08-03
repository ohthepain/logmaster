import { Link } from '@tanstack/react-router'
import { ArrowLeft, Camera, Plus, Sailboat } from 'lucide-react'
import type { Trip } from '../domain/logbook'
import type { CrewMember } from '../domain/crew'
import {
  firstName,
  formatTripDateRange,
  formatTripRelativeStatus,
  tripHeroTitle,
} from '../lib/trip-display'
import { CrewAvatar } from './CrewAvatar'
import { DevComponentLabel } from './DevComponentLabel'

type TripDetailHeroProps = {
  trip: Trip
  title: string
  coverPhoto: string | null
  busy: boolean
  skipperName: string | null
  skipperImageUrl: string | null
  skipperUserId?: string
  crewMembers: CrewMember[]
  crewLoading: boolean
  onTitleChange: (value: string) => void
  onTitleBlur: () => void
  onPhotoClick: () => void
  onAddCrewClick: () => void
}

export function TripDetailHero({
  trip,
  title,
  coverPhoto,
  busy,
  skipperName,
  skipperImageUrl,
  skipperUserId,
  crewMembers,
  crewLoading,
  onTitleChange,
  onTitleBlur,
  onPhotoClick,
  onAddCrewClick,
}: TripDetailHeroProps) {
  return (
    <section className="relative isolate min-h-[min(28rem,72vh)] w-full overflow-hidden bg-[var(--chip-bg)]">
      <DevComponentLabel name="TripDetailHero" className="absolute left-3 top-14 z-20 sm:left-4" />

      {coverPhoto ? (
        <img src={coverPhoto} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,#1e3a5f_0%,#0f172a_55%,#020617_100%)] text-white/35">
          <Sailboat className="size-24" strokeWidth={1.1} />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent" />

      <div className="relative z-10 flex min-h-[min(28rem,72vh)] flex-col justify-between px-3 pb-6 pt-3 sm:px-4 sm:pb-8">
        <div className="flex items-start justify-between gap-3">
          <Link
            to="/"
            className="inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm no-underline transition hover:bg-black/45"
            aria-label="Back to trips"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <button
            type="button"
            onClick={onPhotoClick}
            disabled={busy}
            className="inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/45 disabled:opacity-60"
            aria-label="Upload trip photo"
          >
            <Camera className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            {skipperName ? (
              <HeroPerson
                name={skipperName}
                imageUrl={skipperImageUrl}
                userId={skipperUserId}
                label="SKIPPER"
              />
            ) : null}

            {crewMembers.map((member) => (
              <HeroPerson
                key={member.id}
                name={member.name}
                imageUrl={member.imageUrl}
                userId={member.linkedUserId ?? undefined}
                label="CREW"
              />
            ))}

            <button
              type="button"
              onClick={onAddCrewClick}
              className="mb-0.5 inline-flex flex-col items-center gap-1.5 text-white/90 transition hover:text-white"
              aria-label="Add crew"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-full border-2 border-dashed border-white/50 bg-black/20 backdrop-blur-sm">
                <Plus className="size-5" strokeWidth={2.25} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                {crewLoading ? '…' : 'Add'}
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <label className="block">
              <span className="sr-only">Trip name</span>
              <div className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 rounded-xl bg-black/35 px-3 py-2 backdrop-blur-sm">
                <input
                  value={title}
                  onChange={(event) => onTitleChange(event.target.value)}
                  onBlur={onTitleBlur}
                  placeholder={trip.boatName}
                  className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-3xl font-bold leading-tight tracking-tight text-white outline-none ring-0 placeholder:text-white/55 sm:text-4xl"
                />
                {trip.status === 'PLANNED' ? (
                  <span className="text-2xl font-bold text-white/90 sm:text-3xl">(PLANNED)</span>
                ) : null}
              </div>
              <span className="sr-only">{tripHeroTitle({ ...trip, title: title.trim() || trip.title })}</span>
            </label>

            <p className="m-0 text-base font-medium text-white/95 sm:text-lg">
              {formatTripDateRange(trip)}
            </p>
            <p className="m-0 text-sm text-white/80 sm:text-base">
              {formatTripRelativeStatus(trip)}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroPerson({
  name,
  imageUrl,
  userId,
  label,
}: {
  name: string
  imageUrl: string | null
  userId?: string
  label?: string
}) {
  return (
    <div className="flex min-w-[3.5rem] flex-col items-center gap-1">
      <span className="max-w-[4.5rem] truncate text-xs font-semibold text-white drop-shadow-sm">
        {firstName(name)}
      </span>
      <CrewAvatar
        name={name}
        imageUrl={imageUrl}
        userId={userId}
        className="size-12 rounded-full border-2 border-white/80 bg-white/10"
      />
      {label ? (
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
          {label}
        </span>
      ) : null}
    </div>
  )
}
