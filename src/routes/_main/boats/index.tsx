import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus, Sailboat } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AddBoatModal } from '../../../components/AddBoatModal'
import { BoatListCards } from '../../../components/BoatListCards'
import type { Boat } from '../../../domain/boat'
import { useSession } from '../../../lib/auth-client'
import { deleteBoat, fetchBoats } from '../../../lib/boats-api'

type BoatsSearch = { addBoat?: boolean }

export const Route = createFileRoute('/_main/boats/')({
  validateSearch: (search: Record<string, unknown>): BoatsSearch => {
    const value = search.addBoat
    if (value === true || value === 'true' || value === '1' || value === 1) {
      return { addBoat: true }
    }
    return {}
  },
  component: BoatsPage,
})

function BoatsPage() {
  const session = useSession()
  const navigate = useNavigate()
  const { addBoat: addBoatSearch } = Route.useSearch()
  const user = session.data?.user
  const [boats, setBoats] = useState<Boat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addBoatOpen, setAddBoatOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user) {
      setBoats([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setBoats(await fetchBoats())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load boats')
      setBoats([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!addBoatSearch || !user) return
    setAddBoatOpen(true)
    void navigate({ to: '/boats', search: {}, replace: true })
  }, [addBoatSearch, user, navigate])

  const handleDelete = async (boat: Boat) => {
    if (!window.confirm(`Delete "${boat.name}" and all its photos?`)) return
    try {
      await deleteBoat(boat.id)
      setBoats((current) => current.filter((item) => item.id !== boat.id))
      toast.success('Boat deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete boat')
    }
  }

  const openAddBoat = () => setAddBoatOpen(true)

  return (
    <main className="pb-24 pt-2">
      <div className="page-wrap px-3 sm:px-4">
        <div className="mb-6 flex items-center justify-between gap-3 pt-2">
          <h1 className="brand-title m-0 text-[2.35rem] leading-none sm:text-[2.75rem]">
            Boats
          </h1>
          {user && (
            <button
              type="button"
              onClick={openAddBoat}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] transition hover:text-[var(--brand-hover)]"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              Add
            </button>
          )}
        </div>
      </div>

      {!user ? (
        <div className="page-wrap px-3 sm:px-4">
          <section className="rounded-2xl bg-[var(--panel)] px-6 py-10 text-center">
            <p className="m-0 text-[var(--sea-ink-soft)]">
              Sign in to create and manage your boats.
            </p>
            <Link
              to="/sign-in"
              search={{ redirect: '/boats' }}
              className="brand-emphasis mt-4 inline-flex text-sm font-semibold no-underline hover:text-[var(--brand-hover)]"
            >
              Sign in
            </Link>
          </section>
        </div>
      ) : loading ? (
        <div className="page-wrap px-3 sm:px-4">
          <p className="text-sm text-[var(--sea-ink-soft)]">Loading boats…</p>
        </div>
      ) : error ? (
        <div className="page-wrap px-3 sm:px-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : boats.length === 0 ? (
        <div className="page-wrap px-3 sm:px-4">
          <section className="rounded-2xl bg-[var(--panel)] px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--brand-muted)]">
              <Sailboat className="size-6 text-[var(--brand)]" />
            </div>
            <h2 className="m-0 text-xl font-semibold text-[var(--sea-ink)]">
              No boats yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--sea-ink-soft)]">
              Add your first boat with a name and photos.
            </p>
            <button
              type="button"
              onClick={openAddBoat}
              className="brand-emphasis mt-5 inline-flex items-center gap-1.5 text-sm font-semibold hover:text-[var(--brand-hover)]"
            >
              <Plus className="size-4" />
              Add boat
            </button>
          </section>
        </div>
      ) : (
        <BoatListCards
          boats={boats}
          onDelete={(boat) => void handleDelete(boat)}
        />
      )}

      <AddBoatModal
        open={addBoatOpen}
        onClose={() => setAddBoatOpen(false)}
        onCreated={(boat) => {
          setBoats((current) => [...current, boat])
          void navigate({ to: '/boats/$boatId', params: { boatId: boat.id } })
        }}
      />
    </main>
  )
}
