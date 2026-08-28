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
        disabled={disabled}
        data-map-touch-zone
        aria-label={label}
        title={label}
        className={cn(
          'ios-map-touch-target pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-white/25 text-white backdrop-blur-sm transition hover:bg-black/45 disabled:opacity-60',
          active ? 'bg-black/55' : 'bg-black/30',
        )}
      >
        {children}
      </button>
    </MapButtonTooltip>
  )
}
