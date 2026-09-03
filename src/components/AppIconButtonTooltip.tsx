import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type AppIconButtonTooltipProps = {
  label: string
  children: ReactNode
  className?: string
  side?: 'left' | 'right' | 'bottom' | 'top'
}

const sideClasses = {
  right: 'left-[calc(100%+0.45rem)] top-1/2 -translate-y-1/2',
  left: 'right-[calc(100%+0.45rem)] top-1/2 -translate-y-1/2',
  bottom: 'left-1/2 top-[calc(100%+0.45rem)] -translate-x-1/2',
  top: 'left-1/2 bottom-[calc(100%+0.45rem)] -translate-x-1/2',
} as const

export function AppIconButtonTooltip({
  label,
  children,
  className,
  side = 'bottom',
}: AppIconButtonTooltipProps) {
  return (
    <div className={cn('group relative', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-40',
          sideClasses[side],
          'whitespace-nowrap rounded-lg border border-[var(--chip-line)] bg-[var(--surface-strong)] px-2.5 py-1',
          'text-[11px] font-semibold text-[var(--sea-ink)] shadow-md',
          'opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {label}
      </span>
    </div>
  )
}
