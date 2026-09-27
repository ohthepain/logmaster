import type { ReactNode } from 'react'
import { MapButtonTooltip } from './MapButtonTooltip'
import { cn } from '../lib/cn'

type TripMapChromeButtonProps = {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: ReactNode
  tooltipSide?: 'left' | 'right' | 'bottom'
}

export function TripMapChromeButton({
  label,
  onClick,
  disabled = false,
  active = false,
  children,
  tooltipSide = 'right',
}: TripMapChromeButtonProps) {
  return (
    <MapButtonTooltip label={label} side={tooltipSide}>
      <button
        type="button"
        onClick={onClick}
        onPointerUp={(event) => {
          event.stopPropagation()
        }}
        disabled={disabled}
        data-map-touch-zone
        aria-label={label}
        title={label}
        className={cn(
          'map-chrome-surface ios-map-touch-target pointer-events-auto inline-flex size-10 touch-manipulation items-center justify-center rounded-full transition hover:bg-[var(--map-chrome-hover)] disabled:opacity-60',
          active && 'map-chrome-active',
        )}
      >
        {children}
      </button>
    </MapButtonTooltip>
  )
}
