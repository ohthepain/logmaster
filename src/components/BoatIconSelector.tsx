import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { BoatIconId } from '../lib/boat-icons'
import { boatIconLabel, boatIconSrc } from '../lib/boat-icons'
import { cn } from '../lib/cn'
import { BoatIconPickerDialog } from './BoatIconPickerDialog'

type BoatIconSelectorProps = {
  value: BoatIconId
  onChange: (iconId: BoatIconId) => void
  disabled?: boolean
  className?: string
  /** Use when opening the picker from inside another modal. */
  pickerLayer?: 'base' | 'overlay'
}

export function BoatIconSelector({
  value,
  onChange,
  disabled = false,
  className,
  pickerLayer = 'base',
}: BoatIconSelectorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className={className}>
      <span className="mb-2 block text-sm font-medium text-[var(--sea-ink)]">
        Map icon
      </span>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setPickerOpen(true)}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-3 text-left transition hover:border-[var(--line)]',
          disabled && 'opacity-60',
        )}
      >
        <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--panel)]">
          <img
            src={boatIconSrc(value)}
            alt=""
            draggable={false}
            className="max-h-[4.5rem] max-w-full object-contain"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--sea-ink)]">
            {boatIconLabel(value)}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--sea-ink-soft)]">
            Shown on the map while recording and during playback
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-[var(--sea-ink-soft)]" />
      </button>

      <BoatIconPickerDialog
        open={pickerOpen}
        value={value}
        onClose={() => setPickerOpen(false)}
        onSelect={onChange}
        layer={pickerLayer}
      />
    </div>
  )
}
