import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  deleteAdminTrip,
  fetchAdminTrips,
} from '../../../lib/admin-api'
import { useSession } from '../../../lib/auth-client'
import {
  formatTripDateRange,
  tripDisplayName,
} from '../../../lib/trip-display'
import { useIsAdmin } from '../../../lib/use-admin'
import type { Trip } from '../../../domain/logbook'

export const Route = createFileRoute('/_main/admin/trips')({
  component: AdminTripsPage,
})

function AdminTripsPage() {
  const session = useSession()
  const navigate = useNavigate()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      setTrips(await fetchAdminTrips())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load trips')
      setTrips([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (adminLoading || session.isPending) return
    if (!session.data?.user || !isAdmin) {
      void navigate({ to: '/' })
      return
    }
    void load()
  }, [adminLoading, isAdmin, load, navigate, session.data?.user, session.isPending])

  const handleDelete = async (trip: Trip) => {
    const name = tripDisplayName(trip)
    if (
      !window.confirm(
        `Delete trip "${name}" and all its log entries? This cannot be undone.`,
      )
    ) {
      return
    }

    setDeletingId(trip.id)
    try {
      await deleteAdminTrip(trip.id)
      setTrips((current) => current.filter((item) => item.id !== trip.id))
      toast.message('Trip deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete trip')
    } finally {
      setDeletingId(null)
    }
  }

  if (adminLoading || session.isPending || !isAdmin) {
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
        <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          Trips
        </h1>
        <p className="m-0 mb-4 text-sm text-[var(--sea-ink-soft)]">
          <Link
            to="/admin"
            className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
          >
            ← Admin
          </Link>
        </p>

        <div className="mb-4">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--sea-ink)]"
          >
            Refresh
          </button>
        </div>

        {loading && <p className="text-[var(--sea-ink-soft)]">Loading…</p>}
        {err && <p className="text-red-700 dark:text-red-300">{err}</p>}

        {!loading && !err && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {trips.length === 0 && (
              <li className="py-4 text-[var(--sea-ink-soft)]">No trips yet.</li>
            )}
            {trips.map((trip) => {
              const name = tripDisplayName(trip)
              const busy = deletingId === trip.id
              return (
                <li
                  key={trip.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--header-bg)]/40 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate font-semibold text-[var(--sea-ink)]">
                      {name}
                    </p>
                    <p className="m-0 mt-0.5 text-sm text-[var(--sea-ink-soft)]">
                      {trip.status.replace('_', ' ').toLowerCase()} ·{' '}
                      {formatTripDateRange(trip)} ·{' '}
                      <span className="font-mono text-xs">{trip.id}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(trip)}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                  >
                    {busy ? 'Deleting…' : 'Delete'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
