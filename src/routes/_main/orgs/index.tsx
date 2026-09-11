import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Building2, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AddOrgModal } from '../../../components/AddOrgModal'
import { OrgIcon, orgIconPhoto } from '../../../components/OrgIcon'
import type { Org } from '../../../domain/org'
import { useSession } from '../../../lib/auth-client'
import { fetchOrgs } from '../../../lib/orgs-api'

type OrgsSearch = { addOrg?: boolean }

export const Route = createFileRoute('/_main/orgs/')({
  validateSearch: (search: Record<string, unknown>): OrgsSearch => {
    const value = search.addOrg
    if (value === true || value === 'true' || value === '1' || value === 1) {
      return { addOrg: true }
    }
    return {}
  },
  component: OrgsPage,
})

function OrgsPage() {
  const session = useSession()
  const navigate = useNavigate()
  const { addOrg: addOrgSearch } = Route.useSearch()
  const user = session.data?.user
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user) {
      setOrgs([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setOrgs(await fetchOrgs())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organizations')
      setOrgs([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!addOrgSearch || !user) return
    setAddOpen(true)
    void navigate({ to: '/orgs', search: {}, replace: true })
  }, [addOrgSearch, user, navigate])

  const openAdd = () => setAddOpen(true)

  return (
    <main className="pb-24 pt-2">
      <div className="page-wrap px-3 sm:px-4">
        <div className="mb-6 flex items-center justify-between gap-3 pt-2">
          <h1 className="brand-title m-0 text-[2.35rem] leading-none sm:text-[2.75rem]">
            Orgs
          </h1>
          {user && (
            <button
              type="button"
              onClick={openAdd}
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
              Sign in to view and manage your organizations.
            </p>
            <Link
              to="/sign-in"
              search={{ redirect: '/orgs' }}
              className="brand-emphasis mt-4 inline-flex text-sm font-semibold no-underline hover:text-[var(--brand-hover)]"
            >
              Sign in
            </Link>
          </section>
        </div>
      ) : loading ? (
        <div className="page-wrap px-3 sm:px-4">
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Loading organizations…
          </p>
        </div>
      ) : error ? (
        <div className="page-wrap px-3 sm:px-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : orgs.length === 0 ? (
        <div className="page-wrap px-3 sm:px-4">
          <section className="rounded-2xl bg-[var(--panel)] px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--brand-muted)]">
              <Building2 className="size-6 text-[var(--brand)]" />
            </div>
            <h2 className="m-0 text-xl font-semibold text-[var(--sea-ink)]">
              No organizations yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--sea-ink-soft)]">
              Create an organization to share boats, documents, and members.
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="brand-emphasis mt-5 inline-flex items-center gap-1.5 text-sm font-semibold hover:text-[var(--brand-hover)]"
            >
              <Plus className="size-4" />
              Add organization
            </button>
          </section>
        </div>
      ) : (
        <div className="page-wrap px-3 sm:px-4">
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map((org) => {
              const icon = orgIconPhoto(org)
              return (
                <li key={org.id}>
                  <Link
                    to="/orgs/$orgId"
                    params={{ orgId: org.id }}
                    className="group flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 no-underline shadow-sm transition hover:border-[var(--chip-line)] hover:shadow-md"
                  >
                    <OrgIcon photo={icon} size="md" />
                    <div className="min-w-0 flex-1">
                      <h2 className="m-0 truncate text-lg font-semibold leading-tight text-[var(--sea-ink)]">
                        {org.name}
                      </h2>
                      <p className="m-0 mt-1 truncate text-sm text-[var(--sea-ink-soft)]">
                        {org.memberCount ?? 0}{' '}
                        {(org.memberCount ?? 0) === 1 ? 'member' : 'members'}
                        {org.boats?.length
                          ? ` · ${org.boats.length} ${
                              org.boats.length === 1 ? 'boat' : 'boats'
                            }`
                          : ''}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <AddOrgModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(org) => {
          setOrgs((current) => [org, ...current])
          void navigate({
            to: '/orgs/$orgId',
            params: { orgId: org.id },
          })
        }}
      />
    </main>
  )
}
