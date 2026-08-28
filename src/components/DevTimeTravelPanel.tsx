import { Clock } from 'lucide-react'
import { cn } from '../lib/cn'
import { formatDateTime } from '../lib/logbook-format'
import {
  advanceIso,
  datetimeLocalValueToIso,
  isoToDatetimeLocalValue,
  realNowIso,
} from '../lib/dev-time-travel'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

type DevTimeTravelPanelProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  valueIso: string
  onChange: (iso: string) => void
  tripStartedAt?: string | null
  replayActive?: boolean
}

export function DevTimeTravelPanel({
  enabled,
  onEnabledChange,
  valueIso,
  onChange,
  tripStartedAt,
  replayActive = false,
}: DevTimeTravelPanelProps) {
  const localValue = isoToDatetimeLocalValue(valueIso)

  return (
    <div className="rounded-[1.25rem] border border-dashed border-[var(--brand)]/45 bg-[color-mix(in_oklab,var(--brand-muted)_35%,var(--panel))] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-[var(--brand)]" strokeWidth={2.25} />
          <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">Time travel</p>
        </div>
        <button
          type="button"
          aria-pressed={enabled}
          onClick={() => onEnabledChange(!enabled)}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] transition',
            'outline-none focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel)]',
            enabled
              ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm'
              : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] hover:border-[var(--line)] hover:text-[var(--sea-ink)]',
          )}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </div>
      <p className="m-0 text-xs leading-5 text-[var(--sea-ink-soft)]">
        {enabled
          ? replayActive
            ? 'The replay and new log entries follow this moving fake clock.'
            : 'New log entries will use the time below instead of now.'
          : 'Turn on to set a custom timestamp for the next log entry.'}
      </p>
      <fieldset
        disabled={!enabled}
        className={cn('mt-3 border-0 p-0', !enabled && 'opacity-55')}
      >
      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-medium text-[var(--sea-ink-soft)]">
          Entry time
        </span>
        <input
          type="datetime-local"
          value={localValue}
          onChange={(event) => {
            const iso = datetimeLocalValueToIso(event.target.value)
            if (iso) onChange(iso)
          }}
          className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2.5 text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
        />
      </label>
      <p className="m-0 mt-2 text-xs text-[var(--sea-ink-soft)]">
        {formatDateTime(valueIso)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <TimeTravelButton label="Now" onClick={() => onChange(realNowIso())} />
        <TimeTravelButton
          label="+1 h"
          onClick={() => onChange(advanceIso(valueIso, HOUR_MS))}
        />
        <TimeTravelButton
          label="+6 h"
          onClick={() => onChange(advanceIso(valueIso, 6 * HOUR_MS))}
        />
        <TimeTravelButton
          label="+1 d"
          onClick={() => onChange(advanceIso(valueIso, DAY_MS))}
        />
        {tripStartedAt ? (
          <TimeTravelButton label="Trip start" onClick={() => onChange(tripStartedAt)} />
        ) : null}
      </div>
      </fieldset>
    </div>
  )
}

function TimeTravelButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-[11px] font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
    >
      {label}
    </button>
  )
}
