import { LocateFixed, Maximize2, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'

type SailingMapControlStackProps = {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate: () => void
  onExpand?: () => void
}

export function SailingMapControlStack({
  onZoomIn,
  onZoomOut,
  onLocate,
  onExpand,
}: SailingMapControlStackProps) {
  return (
    <div className="sailing-map-controls pointer-events-none absolute right-2.5 top-2.5 z-10">
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-md border border-[rgba(126,200,232,0.2)] bg-[rgba(26,51,72,0.94)] shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
        <MapControlButton label="Zoom in" onClick={onZoomIn}>
          <Plus className="size-4" strokeWidth={2.25} />
        </MapControlButton>
        <MapControlButton label="Zoom out" onClick={onZoomOut} bordered>
          <Minus className="size-4" strokeWidth={2.25} />
        </MapControlButton>
        <MapControlButton label="Center on your location" onClick={onLocate} bordered>
          <LocateFixed className="size-4" strokeWidth={2.25} />
        </MapControlButton>
        {onExpand ? (
          <MapControlButton label="Open full-screen map" onClick={onExpand} bordered>
            <Maximize2 className="size-4" strokeWidth={2.25} />
          </MapControlButton>
        ) : null}
      </div>
    </div>
  )
}

function MapControlButton({
  label,
  onClick,
  bordered,
  children,
}: {
  label: string
  onClick: () => void
  bordered?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-[29px] w-[29px] items-center justify-center text-white/95 transition hover:bg-[rgba(126,200,232,0.16)] ${
        bordered ? 'border-t border-[rgba(126,200,232,0.2)]' : ''
      }`}
    >
      {children}
    </button>
  )
}
