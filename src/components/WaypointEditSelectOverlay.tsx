import { X } from 'lucide-react'
import { cn } from '../lib/cn'

type WaypointEditSelectOverlayProps = {
  onCancel: () => void
  className?: string
}

export function WaypointEditSelectOverlay({
  onCancel,
  className,
}: WaypointEditSelectOverlayProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-30', className)}
      aria-hidden={false}
    >
      <div className="pointer-events-auto absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4">
        <p className="m-0 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          Tap a waypoint to move it
        </p>
        <button
          type="button"
          aria-label="Cancel editing waypoints"
          onClick={onCancel}
          className="inline-flex size-12 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  )
}
