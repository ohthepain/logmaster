import type { BoatIconId } from '../lib/boat-icons'
import { BOAT_ICONS } from '../lib/boat-icons'
import { cn } from '../lib/cn'
import { Modal } from './Modal'

type BoatIconPickerDialogProps = {
  open: boolean
  value: BoatIconId
  onClose: () => void
  onSelect: (iconId: BoatIconId) => void
  layer?: 'base' | 'overlay'
}

export function BoatIconPickerDialog({
  open,
  value,
  onClose,
  onSelect,
  layer = 'base',
}: BoatIconPickerDialogProps) {
  if (!open) return null

  const handleSelect = (iconId: BoatIconId) => {
    onSelect(iconId)
    onClose()
  }

  return (
    <Modal
      title="Choose map icon"
      onClose={onClose}
      layer={layer}
      devComponentName="BoatIconPickerDialog"
    >
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
        Icons point north on the map and rotate with your heading.
      </p>

      <div
        className="mt-4 max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain pr-1"
        role="radiogroup"
        aria-label="Boat map icons"
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {BOAT_ICONS.map((icon) => {
            const selected = icon.id === value
            return (
              <button
                key={icon.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={icon.label}
                onClick={() => handleSelect(icon.id)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border bg-[var(--chip-bg)] px-2 py-3 transition',
                  selected
                    ? 'border-[var(--active-border)] ring-2 ring-[var(--sea-ink)]/15'
                    : 'border-[var(--chip-line)] hover:border-[var(--line)]',
                )}
              >
                <span className="flex h-24 w-full items-center justify-center">
                  <img
                    src={icon.src}
                    alt=""
                    draggable={false}
                    className="max-h-24 max-w-full object-contain"
                  />
                </span>
                <span className="line-clamp-2 text-center text-xs font-medium leading-tight text-[var(--sea-ink)]">
                  {icon.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
