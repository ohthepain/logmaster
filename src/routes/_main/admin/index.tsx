import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSession } from '../../../lib/auth-client'
import { useIsAdmin } from '../../../lib/use-admin'

export const Route = createFileRoute('/_main/admin/')({
  component: AdminHome,
})

function AdminHome() {
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
        <p className="island-kicker mb-2">Admin</p>
        <h1 className="display-title mb-4 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          Operations
        </h1>
        <p className="m-0 mb-6 max-w-2xl text-base leading-7 text-[var(--sea-ink-soft)]">
          Browse background job status and reference data. APIs live under{' '}
          <code className="rounded bg-[var(--chip-bg)] px-1.5 py-0.5 text-sm">
            /api/admin/…
          </code>
          .
        </p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          <li>
            <Link
              to="/admin/trips"
              className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
            >
              Trips
            </Link>
            <span className="text-[var(--sea-ink-soft)]"> — </span>
            <span className="text-[var(--sea-ink-soft)]">
              view and delete all trips
            </span>
          </li>
          <li>
            <Link
              to="/admin/users"
              className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
            >
              Users
            </Link>
            <span className="text-[var(--sea-ink-soft)]"> — </span>
            <span className="text-[var(--sea-ink-soft)]">
              view and delete user accounts
            </span>
          </li>
          <li>
            <Link
              to="/admin/job-management"
              className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
            >
              Jobs
            </Link>
            <span className="text-[var(--sea-ink-soft)]"> — </span>
            <span className="text-[var(--sea-ink-soft)]">
              all runs, output, re-run, and duration
            </span>
          </li>
          <li>
            <Link
              to="/admin/jobs"
              className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
            >
              Background jobs
            </Link>
            <span className="text-[var(--sea-ink-soft)]"> — </span>
            <span className="text-[var(--sea-ink-soft)]">
              start map data builds (geo features, marinas)
            </span>
          </li>
          <li>
            <Link
              to="/admin/countries"
              className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
            >
              Countries
            </Link>
            <span className="text-[var(--sea-ink-soft)]"> — </span>
            <span className="text-[var(--sea-ink-soft)]">
              import GeoNames <code className="text-sm">countryInfo.txt</code> →{' '}
              <code className="text-sm">countries.json</code>
            </span>
          </li>
        </ul>
      </section>
    </main>
  )
}
