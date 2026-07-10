import { Plus } from 'lucide-react'
import { cn } from '../lib/cn'

type AddButtonProps = {
  onClick: () => void
  'aria-label': string
  className?: string
}

export function AddButton({ onClick, 'aria-label': ariaLabel, className }: AddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)]',
        className,
      )}
    >
      <Plus className="size-5" strokeWidth={2.5} />
    </button>
  )
}
