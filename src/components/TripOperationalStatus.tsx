import { FileText } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { entryTitle, isLogEntryTypeVisible } from '../domain/logbook'
import type { LogEntry, Trip } from '../domain/logbook'
import {
  isOperationalToggleOn,
  operationalToggleConfirmPrompt,
  operationalToggleEntryType,
  OPERATIONAL_TOGGLES,
  resolveTripOperationalState,
} from '../domain/trip-state'
import type { OperationalToggle } from '../domain/trip-state'
import { cn } from '../lib/cn'
import {
  MAP_CHROME_BUTTON_HOVER_CLASS,
  MAP_CHROME_DIVIDER_CLASS,
  MAP_CHROME_OPERATIONAL_CELL_CLASS,
  MAP_CHROME_SURFACE_CLASS,
} from '../lib/map-chrome'
import { useLogbookStore } from '../stores/logbook'
import { DevComponentLabel } from './DevComponentLabel'
import { MapButtonTooltip } from './MapButtonTooltip'
import { OperationalToggleButton } from './OperationalToggleButton'
import { TripOperationalConfirmModal } from './TripOperationalConfirmModal'

type PendingOperationalConfirm = {
  toggle: OperationalToggle
  targetOn: boolean
}

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
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingOperationalConfirm | null>(null)

  if (trip.status === 'PLANNED') return null

  const state = resolveTripOperationalState(trip, entries)
  const interactive = trip.status === 'IN_PROGRESS'

  const applyToggle = async (toggle: OperationalToggle, targetOn: boolean) => {
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

  const requestToggle = (toggle: OperationalToggle, targetOn: boolean) => {
    if (!interactive || busyToggle) return

    const currentOn = isOperationalToggleOn(toggle, state)
    if (targetOn === currentOn) return

    const entryType = operationalToggleEntryType(toggle, targetOn)
    if (!isLogEntryTypeVisible(entryType, trip, entries)) return

    setPendingConfirm({ toggle, targetOn })
  }

  const confirmPending = () => {
    if (!pendingConfirm || busyToggle) return
    const next = pendingConfirm
    setPendingConfirm(null)
    void applyToggle(next.toggle, next.targetOn)
  }

  return (
    <>
      <div className="pointer-events-none absolute left-2.5 top-1/2 z-20 -translate-y-1/2 sm:left-3">
        <DevComponentLabel
          name="TripOperationalStatus"
          className="absolute -left-1 bottom-full mb-1 opacity-70"
        />
        <div
          className={cn(
            'pointer-events-auto flex flex-col overflow-visible',
            MAP_CHROME_SURFACE_CLASS,
          )}
        >
          {OPERATIONAL_TOGGLES.map((toggle, index) => {
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
              busyToggle === null &&
              !pendingConfirm &&
              interactive &&
              (checked ? canTurnOff : canTurnOn)

            return (
              <OperationalToggleButton
                key={toggle}
                toggle={toggle}
                checked={checked}
                pending={pending}
                disabled={!canToggle}
                bordered={index > 0}
                onCheckedChange={(targetOn) => requestToggle(toggle, targetOn)}
              />
            )
          })}
          {interactive && onLogEntryClick ? (
            <MapButtonTooltip label="Log entry">
              <button
                type="button"
                disabled={logEntryDisabled || pendingConfirm !== null}
                onClick={onLogEntryClick}
                className={cn(
                  MAP_CHROME_OPERATIONAL_CELL_CLASS,
                  'text-white/95',
                  MAP_CHROME_BUTTON_HOVER_CLASS,
                  MAP_CHROME_DIVIDER_CLASS,
                  'disabled:cursor-default disabled:opacity-50',
                )}
                aria-label="Log entry"
                title="Log entry"
              >
                <FileText className="size-5" strokeWidth={2.25} />
              </button>
            </MapButtonTooltip>
          ) : null}
        </div>
      </div>

      {pendingConfirm ? (
        <TripOperationalConfirmModal
          prompt={operationalToggleConfirmPrompt(
            pendingConfirm.toggle,
            pendingConfirm.targetOn,
          )}
          onClose={() => setPendingConfirm(null)}
          onConfirm={confirmPending}
        />
      ) : null}
    </>
  )
}
