import { Link, useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useSession } from '../../lib/auth-client'
import { useIsAdmin } from '../../lib/use-admin'

type AdminPageShellProps = {
  kicker?: string
  title: string
  description?: ReactNode
  backTo?: { to: string; label: string }
  children: ReactNode
}

export function AdminPageShell({
  kicker = 'Admin',
  title,
  description,
  backTo = { to: '/admin', label: 'Admin' },
  children,
}: AdminPageShellProps) {
  const session = useSession()
  const navigate = useNavigate()
  const { isAdmin, loading } = useIsAdmin()

  useEffect(() => {
    if (loading || session.isPending) return
    if (!session.data?.user || !isAdmin) {
      void navigate({ to: '/' })
    }
  }, [isAdmin, loading, navigate, session.data?.user, session.isPending])

  if (loading || session.isPending || !isAdmin) {
    return (
      <main className="page-wrap px-4 py-8">
        <p className="text-[var(--sea-ink-soft)]">Loading…</p>
      </main>
    )
  }

  return (
    <main className="page-wrap px-4 py-8">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">{kicker}</p>
        <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="m-0 mb-4 max-w-2xl text-sm leading-6 text-[var(--sea-ink-soft)]">
            {description}
          </p>
        ) : null}
        <p className="m-0 mb-6 text-sm text-[var(--sea-ink-soft)]">
          <Link
            to={backTo.to}
            className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
          >
            ← {backTo.label}
          </Link>
        </p>
        {children}
      </section>
    </main>
  )
}
