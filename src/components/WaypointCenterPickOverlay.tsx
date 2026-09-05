import { Check, Trash2, X } from 'lucide-react'
import type { MapLngLat } from '../lib/logbook-map-geo'
import { formatMapCenterLabel } from '../lib/map-center-position'
import { mapBrandColor } from '../lib/logbook-map-geo'
import { cn } from '../lib/cn'

type WaypointCenterPickOverlayProps = {
  position: MapLngLat | null
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  hideCenterMarker?: boolean
  onDelete?: () => void
  className?: string
}

export function WaypointCenterPickOverlay({
  position,
  busy = false,
  onCancel,
  onConfirm,
  confirmLabel = 'Add waypoint',
  hideCenterMarker = false,
  onDelete,
  className,
}: WaypointCenterPickOverlayProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-30', className)}
      aria-hidden={false}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
        <div className="absolute bottom-0 top-0 left-1/2 w-px -translate-x-1/2 bg-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
        {hideCenterMarker ? null : (
        <div
          className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-md"
          style={{ backgroundColor: mapBrandColor() }}
        />
        )}
      </div>

      <div className="pointer-events-auto absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4">
        <p className="m-0 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium tabular-nums text-white backdrop-blur-sm">
          {position ? formatMapCenterLabel(position) : '…'}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Cancel waypoint"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex size-12 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-60"
          >
            <X className="size-5" />
          </button>
          {onDelete ? (
            <button
              type="button"
              aria-label="Delete waypoint"
              disabled={busy}
              onClick={onDelete}
              className="inline-flex size-12 items-center justify-center rounded-full border border-white/25 bg-red-600/90 text-white shadow-md backdrop-blur-sm transition hover:bg-red-600 disabled:opacity-60"
            >
              <Trash2 className="size-5" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={confirmLabel}
            disabled={busy || !position}
            onClick={onConfirm}
            className="inline-flex size-12 items-center justify-center rounded-full border border-white/25 bg-[var(--brand)] text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
          >
            <Check className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
