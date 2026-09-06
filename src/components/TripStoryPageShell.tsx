import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type TripStoryPageShellProps = {
  children: ReactNode
  toolbar?: ReactNode
  className?: string
}

export function TripStoryPageShell({
  children,
  toolbar,
  className,
}: TripStoryPageShellProps) {
  return (
    <div
      className={cn(
        'trip-story-page flex min-h-dvh flex-col bg-[var(--bg-base)] text-[var(--sea-ink)]',
        className,
      )}
    >
      {toolbar ? (
        <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--bg-base)]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--bg-base)]/80">
          <div
            className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            {toolbar}
          </div>
        </header>
      ) : null}
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
