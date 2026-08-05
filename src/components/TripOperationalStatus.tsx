import { useState } from 'react'
import { toast } from 'sonner'
import { entryTitle, isLogEntryTypeVisible } from '../domain/logbook'
import type { LogEntry, Trip } from '../domain/logbook'
import {
  isOperationalToggleOn,
  operationalToggleEntryType,
  operationalToggleLabel,
  operationalToggleSideLabels,
  OPERATIONAL_TOGGLES,
  resolveTripOperationalState,
  type OperationalToggle,
} from '../domain/trip-state'
import { cn } from '../lib/cn'
import { useLogbookStore } from '../stores/logbook'
import { DevComponentLabel } from './DevComponentLabel'

type TripOperationalStatusProps = {
  tripId: string
  trip: Pick<
    Trip,
    'status' | 'sailsUp' | 'engineOn' | 'moored' | 'anchorDown'
  >
  entries?: Pick<LogEntry, 'type' | 'timestamp' | 'deleted'>[]
}

export function TripOperationalStatus({
  tripId,
  trip,
  entries = [],
}: TripOperationalStatusProps) {
  const addEntry = useLogbookStore((state) => state.addEntry)
  const [busyToggle, setBusyToggle] = useState<OperationalToggle | null>(null)

  if (trip.status === 'PLANNED') return null

  const state = resolveTripOperationalState(trip, entries)
  const interactive = trip.status === 'IN_PROGRESS'

  const handleSelect = async (toggle: OperationalToggle, targetOn: boolean) => {
    if (!interactive || busyToggle) return

    const currentOn = isOperationalToggleOn(toggle, state)
    if (targetOn === currentOn) return

    const entryType = operationalToggleEntryType(toggle, targetOn)
    if (!isLogEntryTypeVisible(entryType, trip, entries)) return

    setBusyToggle(toggle)
    try {
      const entry = await addEntry({ tripId, type: entryType })
      if (!entry) return
      toast.success(entryTitle(entryType))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to log entry',
      )
    } finally {
      setBusyToggle(null)
    }
  }

  return (
    <div className="relative rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--panel)] p-3 sm:p-4">
      <DevComponentLabel
        name="TripOperationalStatus"
        className="absolute left-3 top-3 z-10"
      />
      <div className="flex gap-2">
        {OPERATIONAL_TOGGLES.map((toggle) => (
          <OperationalSwitch
            key={toggle}
            label={operationalToggleLabel(toggle)}
            leftLabel={operationalToggleSideLabels(toggle).left}
            rightLabel={operationalToggleSideLabels(toggle).right}
            checked={isOperationalToggleOn(toggle, state)}
            pending={busyToggle === toggle}
            disabled={!interactive || busyToggle !== null}
            canSelectLeft={
              interactive &&
              isLogEntryTypeVisible(
                operationalToggleEntryType(toggle, false),
                trip,
                entries,
              )
            }
            canSelectRight={
              interactive &&
              isLogEntryTypeVisible(
                operationalToggleEntryType(toggle, true),
                trip,
                entries,
              )
            }
            onSelect={(targetOn) => void handleSelect(toggle, targetOn)}
          />
        ))}
      </div>
    </div>
  )
}

type OperationalSwitchProps = {
  label: string
  leftLabel: string
  rightLabel: string
  checked: boolean
  pending: boolean
  disabled: boolean
  canSelectLeft: boolean
  canSelectRight: boolean
  onSelect: (targetOn: boolean) => void
}

function OperationalSwitch({
  label,
  leftLabel,
  rightLabel,
  checked,
  pending,
  disabled,
  canSelectLeft,
  canSelectRight,
  onSelect,
}: OperationalSwitchProps) {
  return (
    <div className="min-w-0 flex-1">
      <p className="m-0 mb-1.5 truncate text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sea-ink-soft)]">
        {label}
      </p>
      <div
        role="group"
        aria-label={label}
        className="flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] p-0.5"
      >
        <SwitchSide
          label={leftLabel}
          selected={!checked}
          pending={pending && !checked}
          disabled={disabled || !canSelectLeft}
          onClick={() => onSelect(false)}
        />
        <SwitchSide
          label={rightLabel}
          selected={checked}
          pending={pending && checked}
          disabled={disabled || !canSelectRight}
          onClick={() => onSelect(true)}
        />
      </div>
    </div>
  )
}

type SwitchSideProps = {
  label: string
  selected: boolean
  pending: boolean
  disabled: boolean
  onClick: () => void
}

function SwitchSide({
  label,
  selected,
  pending,
  disabled,
  onClick,
}: SwitchSideProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-w-0 flex-1 truncate rounded-full px-1.5 py-1.5 text-[10px] font-semibold transition',
        selected
          ? 'bg-[var(--sea-ink)] text-[var(--btn-text)] shadow-sm'
          : 'text-[var(--sea-ink-soft)]',
        !disabled && !selected && 'hover:text-[var(--sea-ink)]',
        disabled && 'cursor-default',
        disabled && !selected && 'opacity-60',
      )}
    >
      {pending ? '…' : label}
    </button>
  )
}
