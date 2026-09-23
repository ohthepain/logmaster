import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { LegalFooter } from './LegalFooter'

export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="pb-[var(--lm-safe-bottom)] pt-[var(--lm-safe-top)]">
      <header className="page-wrap flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] py-5">
        <Link
          to="/about"
          className="flex items-center gap-2 font-bold tracking-tight"
          aria-label="About Logmaster"
        >
          <img src="/logo_trans_512.png" alt="" width={36} height={36} />
          <span>logmaster</span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-5 text-sm font-semibold"
        >
          <Link
            to="/about"
            activeProps={{ className: 'underline underline-offset-4' }}
          >
            About
          </Link>
          <Link
            to="/contact"
            activeProps={{ className: 'underline underline-offset-4' }}
          >
            Contact
          </Link>
          <Link
            to="/"
            className="rounded-full border border-[var(--line)] px-4 py-2 hover:bg-[var(--chip-bg)]"
          >
            Open app
          </Link>
        </nav>
      </header>
      <main className="page-wrap py-12 sm:py-20">{children}</main>
      <footer className="page-wrap border-t border-[var(--line)] py-8">
        <LegalFooter />
        <p className="mt-4 text-center text-xs text-[var(--sea-ink-soft)]">
          © 2026 Paul Wilkinson
        </p>
      </footer>
    </div>
  )
}
