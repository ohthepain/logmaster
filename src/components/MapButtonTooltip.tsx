import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type MapButtonTooltipProps = {
  label: string
  children: ReactNode
  className?: string
  side?: 'left' | 'right' | 'bottom'
}

const sideClasses = {
  right: 'left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2',
  left: 'right-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2',
  bottom: 'left-1/2 top-[calc(100%+0.5rem)] -translate-x-1/2',
} as const

export function MapButtonTooltip({
  label,
  children,
  className,
  side = 'right',
}: MapButtonTooltipProps) {
  return (
    <div className={cn('group relative', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-30',
          sideClasses[side],
          'whitespace-nowrap rounded-md border border-white/25 bg-black/75 px-2 py-1',
          'text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-sm',
          'opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {label}
      </span>
    </div>
  )
}
