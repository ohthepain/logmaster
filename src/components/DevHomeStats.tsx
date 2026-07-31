import { cn } from '../lib/cn'
import { isDevModeAvailable } from '../lib/dev-mode'
import { useAppOptionsStore } from '../stores/app-options'
import { useLogbookStore } from '../stores/logbook'

function DevStatRow({
  label,
  value,
  muted,
}: {
  label: string
  value: number | string
  muted?: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-2.5 py-2">
      <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--sea-ink-soft)]">
        {label}
      </p>
      <p className={cn('m-0 mt-0.5 text-sm font-semibold text-[var(--sea-ink)]', muted && 'text-[var(--sea-ink-soft)]')}>
        {value}
      </p>
    </div>
  )
}

export function DevHomeStats() {
  const devMode = useAppOptionsStore((state) => state.devMode)
  const store = useLogbookStore()

  if (!devMode || !isDevModeAvailable()) return null

  const tripCount = store.trips.length
  const entryCount = store.entries.filter((entry) => !entry.deleted).length
  const unsyncedCount = store.entries.filter((entry) => !entry.synced && !entry.deleted).length
  const syncValue = store.syncMessage ?? (store.online ? 'Ready' : 'Offline')

  return (
    <div className="border-b border-[var(--line)] px-2 py-2" role="none">
      <p className="m-0 mb-2 px-1 text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--brand)]">
        Dev stats
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <DevStatRow label="Trips" value={tripCount} />
        <DevStatRow label="Entries" value={entryCount} />
        <DevStatRow label="Unsynced" value={unsyncedCount} muted={!unsyncedCount} />
        <DevStatRow label="Sync" value={syncValue} />
      </div>
    </div>
  )
}
