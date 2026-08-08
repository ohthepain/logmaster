import { X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { getCurrentPosition } from '../lib/logbook-context'
import { formatPosition } from '../lib/logbook-format'
import {
  formatLogEntryPlace,
  lookupLogEntryPlace,
} from '../lib/logbook-place'
import { DevComponentLabel } from './DevComponentLabel'

type TripOperationalConfirmModalProps = {
  prompt: string
  onClose: () => void
  onConfirm: () => void
}

function useLogLocationLabel(active: boolean): string {
  const [label, setLabel] = useState('Locating…')

  useEffect(() => {
    if (!active) return

    let cancelled = false
    setLabel('Locating…')

    void getCurrentPosition().then(async (position) => {
      if (cancelled) return
      if (position.latitude == null || position.longitude == null) {
        setLabel('Position unavailable')
        return
      }

      const place = await lookupLogEntryPlace(
        position.latitude,
        position.longitude,
      )
      if (cancelled) return

      setLabel(
        place
          ? formatLogEntryPlace(place)
          : formatPosition(position.latitude, position.longitude),
      )
    })

    return () => {
      cancelled = true
    }
  }, [active])

  return label
}

export function TripOperationalConfirmModal({
  prompt,
  onClose,
  onConfirm,
}: TripOperationalConfirmModalProps) {
  const titleId = useId()
  const locationLabel = useLogLocationLabel(true)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--overlay)] p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface-strong)] p-4 shadow-2xl sm:p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DevComponentLabel name="TripOperationalConfirmModal" />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
        >
          <X className="size-4" />
        </button>

        <div className="pr-10">
          <h3
            id={titleId}
            className="m-0 text-xl font-bold leading-snug text-[var(--sea-ink)]"
          >
            {prompt}
          </h3>
          <p className="m-0 mt-2 text-sm leading-6 text-[var(--sea-ink-soft)]">
            {locationLabel}
          </p>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 w-full rounded-full bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)]"
        >
          Log it
        </button>
      </div>
    </div>,
    document.body,
  )
}
