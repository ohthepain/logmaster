import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type MapButtonTooltipProps = {
  label: string
  children: ReactNode
  className?: string
}

export function MapButtonTooltip({
  label,
  children,
  className,
}: MapButtonTooltipProps) {
  return (
    <div className={cn('group relative', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-30 -translate-y-1/2',
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
