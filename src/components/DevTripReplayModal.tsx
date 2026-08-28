import { RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Trip } from '../domain/logbook'
import { defaultReplayTripName } from '../lib/dev-trip-replay'
import { Modal } from './Modal'

type DevTripReplayModalProps = {
  open: boolean
  sourceTrip: Trip
  busy: boolean
  unavailableReason?: string | null
  onClose: () => void
  onConfirm: (name: string) => void
}

export function DevTripReplayModal({
  open,
  sourceTrip,
  busy,
  unavailableReason,
  onClose,
  onConfirm,
}: DevTripReplayModalProps) {
  const [name, setName] = useState(() => defaultReplayTripName(sourceTrip))

  useEffect(() => {
    if (open) setName(defaultReplayTripName(sourceTrip))
  }, [open, sourceTrip])

  if (!open) return null

  const trimmedName = name.trim()

  return (
    <Modal
      title="Replay completed trip?"
      onClose={() => {
        if (!busy) onClose()
      }}
      layer="overlay"
      devComponentName="DevTripReplayModal"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy && !unavailableReason && trimmedName) onConfirm(trimmedName)
        }}
      >
        <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
          The original timing and track will drive a new trip in real time.
          Notes, photos, voice notes, and other human-authored content are not copied.
        </p>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--sea-ink-soft)]">
            New trip name
          </span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2.5 text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20 disabled:opacity-60"
          />
        </label>

        {unavailableReason ? (
          <p className="m-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-[var(--sea-ink)]">
            {unavailableReason}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy || Boolean(unavailableReason) || !trimmedName}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            <RotateCw className="size-4" />
            {busy ? 'Starting…' : 'Start replay'}
          </button>
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
