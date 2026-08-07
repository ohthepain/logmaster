import { FileText } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { entryTitle, isLogEntryTypeVisible } from '../domain/logbook'
import type { LogEntry, Trip } from '../domain/logbook'
import {
  isOperationalToggleOn,
  operationalToggleEntryType,
  operationalToggleLabel,
  operationalToggleOnAtTop,
  OPERATIONAL_TOGGLES,
  resolveTripOperationalState,
  type OperationalToggle,
} from '../domain/trip-state'
import { cn } from '../lib/cn'
import { useLogbookStore } from '../stores/logbook'
import { DevComponentLabel } from './DevComponentLabel'

/** Map overlay offset — keep in sync with TripDetailHero layout. */
export const TRIP_OPERATIONAL_OVERLAY_TOP_CLASS = 'top-[3.25rem]' as const
export const TRIP_OPERATIONAL_OVERLAY_PT_CLASS = 'pt-[3.25rem]' as const

type TripOperationalStatusProps = {
  tripId: string
  trip: Pick<
    Trip,
    'status' | 'sailsUp' | 'engineOn' | 'moored' | 'anchorDown'
  >
  entries?: Pick<LogEntry, 'type' | 'timestamp' | 'deleted'>[]
  onLogEntryClick?: () => void
  logEntryDisabled?: boolean
}

export function TripOperationalStatus({
  tripId,
  trip,
  entries = [],
  onLogEntryClick,
  logEntryDisabled = false,
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
    <div className="relative bg-black/30">
      <DevComponentLabel
        name="TripOperationalStatus"
        className="absolute bottom-0 left-2 z-10 opacity-70"
      />
      <div className="relative flex items-center gap-2 px-3 py-1.5 sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:gap-x-4">
          {OPERATIONAL_TOGGLES.map((toggle) => {
          const checked = isOperationalToggleOn(toggle, state)
          const pending = busyToggle === toggle
          const canTurnOn =
            interactive &&
            isLogEntryTypeVisible(
              operationalToggleEntryType(toggle, true),
              trip,
              entries,
            )
          const canTurnOff =
            interactive &&
            isLogEntryTypeVisible(
              operationalToggleEntryType(toggle, false),
              trip,
              entries,
            )
          const canToggle =
            !pending &&
            (busyToggle === null || busyToggle === toggle) &&
            interactive &&
            (checked ? canTurnOff : canTurnOn)

          return (
            <VerticalToggleSwitch
              key={toggle}
              label={operationalToggleLabel(toggle)}
              checked={checked}
              onAtTop={operationalToggleOnAtTop(toggle)}
              pending={pending}
              disabled={!canToggle}
              onCheckedChange={(targetOn) => void handleSelect(toggle, targetOn)}
            />
          )
        })}
        </div>
        {interactive && onLogEntryClick ? (
          <button
            type="button"
            disabled={logEntryDisabled}
            onClick={onLogEntryClick}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/35 bg-black/40 px-3 text-xs font-semibold text-white shadow-sm transition',
              'hover:border-white/70 disabled:cursor-default disabled:opacity-50',
            )}
          >
            <FileText className="size-3.5" />
            Log
          </button>
        ) : null}
      </div>
    </div>
  )
}

type VerticalToggleSwitchProps = {
  label: string
  checked: boolean
  /** When true, the on/checked state places the thumb at the top. */
  onAtTop?: boolean
  pending?: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

function VerticalToggleSwitch({
  label,
  checked,
  onAtTop = true,
  pending = false,
  disabled = false,
  onCheckedChange,
}: VerticalToggleSwitchProps) {
  const thumbAtTop = onAtTop ? checked : !checked

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80 drop-shadow-sm">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative h-10 w-[1.35rem] shrink-0 rounded-full border shadow-sm transition-colors',
          checked
            ? 'border-white/55 bg-white/30'
            : 'border-white/35 bg-black/40',
          !disabled && 'hover:border-white/70',
          disabled && 'cursor-default opacity-50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute left-1/2 size-[0.85rem] -translate-x-1/2 rounded-full bg-white shadow transition-[top] duration-200 ease-out',
            thumbAtTop ? 'top-[3px]' : 'top-[calc(100%-0.85rem-3px)]',
            pending && 'animate-pulse',
          )}
        />
      </button>
    </div>
  )
}
