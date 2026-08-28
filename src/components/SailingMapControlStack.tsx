import { LocateFixed, Maximize2, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import {
  MAP_CHROME_BUTTON_HOVER_CLASS,
  MAP_CHROME_CELL_CLASS,
  MAP_CHROME_DIVIDER_CLASS,
  MAP_CHROME_SURFACE_CLASS,
} from '../lib/map-chrome'

type SailingMapControlStackProps = {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate?: () => void
  layers?: ReactNode
  onExpand?: () => void
  className?: string
}

export function SailingMapControlStack({
  onZoomIn,
  onZoomOut,
  onLocate,
  layers,
  onExpand,
  className,
}: SailingMapControlStackProps) {
  return (
    <div
      className={cn(
        'sailing-map-controls pointer-events-none absolute right-2.5 top-1/2 z-20 -translate-y-1/2 sm:right-3',
        className,
      )}
    >
      <div
        data-map-touch-zone
        className={cn(
          'ios-map-touch-target pointer-events-auto flex flex-col overflow-visible',
          MAP_CHROME_SURFACE_CLASS,
        )}
      >
        <MapControlButton label="Zoom in" onClick={onZoomIn}>
          <Plus className="size-4" strokeWidth={2.25} />
        </MapControlButton>
        <MapControlButton label="Zoom out" onClick={onZoomOut} bordered>
          <Minus className="size-4" strokeWidth={2.25} />
        </MapControlButton>
        {onLocate ? (
          <MapControlButton label="Center on your location" onClick={onLocate} bordered>
            <LocateFixed className="size-4" strokeWidth={2.25} />
          </MapControlButton>
        ) : null}
        {layers ? (
          <div className={cn('relative', MAP_CHROME_DIVIDER_CLASS)}>{layers}</div>
        ) : null}
        {onExpand ? (
          <MapControlButton label="Open full-screen map" onClick={onExpand} bordered>
            <Maximize2 className="size-4" strokeWidth={2.25} />
          </MapControlButton>
        ) : null}
      </div>
    </div>
  )
}

export function MapControlButton({
  label,
  onClick,
  bordered,
  children,
  'aria-expanded': ariaExpanded,
}: {
  label: string
  onClick: () => void
  bordered?: boolean
  children: ReactNode
  'aria-expanded'?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={ariaExpanded}
      title={label}
      onClick={onClick}
      onPointerUp={(event) => {
        event.stopPropagation()
      }}
      className={cn(
        'ios-map-touch-target touch-manipulation',
        MAP_CHROME_CELL_CLASS,
        'text-white/95',
        MAP_CHROME_BUTTON_HOVER_CLASS,
        bordered && MAP_CHROME_DIVIDER_CLASS,
      )}
    >
      {children}
    </button>
  )
}
