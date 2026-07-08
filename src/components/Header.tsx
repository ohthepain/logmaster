import { Link } from '@tanstack/react-router'
import { Anchor, BookOpenText } from 'lucide-react'
import { cn } from '../lib/cn'
import ThemeToggle from './ThemeToggle'
import { UserMenu } from './UserMenu'

export function AppHeaderBrand({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'group flex shrink-0 items-center gap-2 rounded-md text-[var(--sea-ink)] no-underline outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--lagoon)]/40 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[var(--bg-base)]',
        className,
      )}
      aria-label="logmaster home"
    >
      <span
        className="flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(145deg,rgba(14,68,87,1),rgba(11,36,49,1))] text-[var(--foam)] shadow-lg shadow-cyan-950/20"
        aria-hidden
      >
        <Anchor className="size-4" strokeWidth={2.2} />
      </span>
      <span className="leading-none">
        <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[var(--kicker)]">
          Sailing logbook
        </span>
        <span className="block text-lg font-bold tracking-tight sm:text-xl">
          logmaster
        </span>
      </span>
    </Link>
  )
}

export default function Header() {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-white/5 bg-[color-mix(in_oklab,var(--bg-base)_82%,transparent)] backdrop-blur-xl">
      <div className="page-wrap flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <AppHeaderBrand />
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="hidden items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-xs font-semibold text-[var(--sea-ink)] no-underline transition hover:bg-[var(--link-bg-hover)] sm:inline-flex"
          >
            <BookOpenText className="size-4" />
            Trips
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
