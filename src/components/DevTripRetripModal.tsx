import { RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Trip } from '../domain/logbook'
import { tripDisplayName } from '../lib/trip-display'
import { PLAYBACK_SPEEDS, formatPlaybackSpeed } from './PlaybackSpeedControl'
import { Modal } from './Modal'

const RETRIP_SPEEDS = PLAYBACK_SPEEDS.filter((speed) => speed >= 0.5)

type DevTripRetripModalProps = {
  open: boolean
  sourceTrip: Trip
  busy: boolean
  activeRetripSourceId: string | null
  onClose: () => void
  onConfirm: (timescale: number) => void
  onStopActive: () => void
}

export function DevTripRetripModal({
  open,
  sourceTrip,
  busy,
  activeRetripSourceId,
  onClose,
  onConfirm,
  onStopActive,
}: DevTripRetripModalProps) {
  const [speedIndex, setSpeedIndex] = useState(() =>
    Math.max(0, RETRIP_SPEEDS.indexOf(1)),
  )

  useEffect(() => {
    if (open) setSpeedIndex(Math.max(0, RETRIP_SPEEDS.indexOf(1)))
  }, [open])

  if (!open) return null

  const timescale = RETRIP_SPEEDS[speedIndex] ?? 1
  const replacingActive =
    activeRetripSourceId != null && activeRetripSourceId !== sourceTrip.id

  return (
    <Modal
      title="Arm spoof playback?"
      onClose={() => {
        if (!busy) onClose()
      }}
      layer="overlay"
      devComponentName="DevTripRetripModal"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy) onConfirm(timescale)
        }}
      >
        <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
          Load <span className="font-semibold text-[var(--sea-ink)]">{tripDisplayName(sourceTrip)}</span>{' '}
          position and instrument tracks at the trip start. Review the info panel, then press play to
          begin playback. No log entries are created — start recording on an in-progress trip
          manually to persist spoofed GPS.
        </p>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--sea-ink-soft)]">
            Timescale
          </span>
          <select
            value={speedIndex}
            onChange={(event) => setSpeedIndex(Number(event.target.value))}
            disabled={busy}
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2.5 text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20 disabled:opacity-60"
          >
            {RETRIP_SPEEDS.map((speed, index) => (
              <option key={speed} value={index}>
                {formatPlaybackSpeed(speed)}
              </option>
            ))}
          </select>
        </label>

        {activeRetripSourceId ? (
          <p className="m-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-[var(--sea-ink)]">
            {replacingActive
              ? 'Another trip is currently being spoofed. Arming will replace it.'
              : 'This trip is already armed. Arming again will restart from the beginning.'}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            <RotateCw className="size-4" />
            {busy ? 'Arming…' : 'Arm spoofing'}
          </button>
          {activeRetripSourceId ? (
            <button
              type="button"
              disabled={busy}
              onClick={onStopActive}
              className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-60 dark:text-red-300"
            >
              Stop spoofing
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex items-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
