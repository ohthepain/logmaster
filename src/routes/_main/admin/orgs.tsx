import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  deleteAdminOrg,
  fetchAdminOrgs,
  fetchAdminUsers,
  updateAdminOrgOwner,
} from '../../../lib/admin-api'
import type { AdminOrg, AdminUser } from '../../../lib/admin-api'
import { useSession } from '../../../lib/auth-client'
import { useIsAdmin } from '../../../lib/use-admin'

export const Route = createFileRoute('/_main/admin/orgs')({
  component: AdminOrgsPage,
})

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function AdminOrgsPage() {
  const session = useSession()
  const navigate = useNavigate()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [ownerDrafts, setOwnerDrafts] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const [orgsData, usersData] = await Promise.all([
        fetchAdminOrgs(),
        fetchAdminUsers(),
      ])
      setOrgs(orgsData)
      setUsers(usersData)
      setOwnerDrafts(
        Object.fromEntries(
          orgsData.map((org) => [org.id, org.ownerUserId]),
        ),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load orgs')
      setOrgs([])
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

  const handleDelete = async (org: AdminOrg) => {
    if (
      !window.confirm(
        `Delete org "${org.name}"? Attached boats will be detached; members and org data will be removed.`,
      )
    ) {
      return
    }

    setDeletingId(org.id)
    try {
      await deleteAdminOrg(org.id)
      setOrgs((current) => current.filter((item) => item.id !== org.id))
      toast.message('Org deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete org')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaveOwner = async (org: AdminOrg) => {
    const ownerUserId = ownerDrafts[org.id]
    if (!ownerUserId || ownerUserId === org.ownerUserId) return

    setSavingId(org.id)
    try {
      const updated = await updateAdminOrgOwner(org.id, ownerUserId)
      setOrgs((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      setOwnerDrafts((current) => ({
        ...current,
        [updated.id]: updated.ownerUserId,
      }))
      toast.message('Owner updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update owner')
    } finally {
      setSavingId(null)
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
          Orgs
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
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {orgs.length === 0 && (
              <li className="py-4 text-[var(--sea-ink-soft)]">No orgs yet.</li>
            )}
            {orgs.map((org) => {
              const deleting = deletingId === org.id
              const saving = savingId === org.id
              const ownerDraft = ownerDrafts[org.id] ?? org.ownerUserId
              const ownerDirty = ownerDraft !== org.ownerUserId

              return (
                <li
                  key={org.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--header-bg)]/40 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="m-0 font-semibold text-[var(--sea-ink)]">
                        {org.name}
                      </p>
                      <p className="m-0 mt-0.5 text-xs text-[var(--sea-ink-soft)]">
                        {org.id}
                      </p>
                      <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
                        {org.memberCount}{' '}
                        {org.memberCount === 1 ? 'member' : 'members'} ·{' '}
                        {org.boatCount}{' '}
                        {org.boatCount === 1 ? 'boat' : 'boats'} ·{' '}
                        {org.visibility.toLowerCase()} · updated{' '}
                        {formatDate(org.updatedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void handleDelete(org)}
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                    >
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <label className="min-w-[16rem] flex-1">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--sea-ink-soft)]">
                        Owner user
                      </span>
                      <select
                        value={ownerDraft}
                        disabled={saving || users.length === 0}
                        onChange={(e) =>
                          setOwnerDrafts((current) => ({
                            ...current,
                            [org.id]: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)]"
                      >
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name || user.email} ({user.email})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={saving || !ownerDirty}
                      onClick={() => void handleSaveOwner(org)}
                      className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--sea-ink)] disabled:opacity-60"
                    >
                      {saving ? 'Saving…' : 'Save owner'}
                    </button>
                  </div>
                  <p className="m-0 mt-2 text-xs text-[var(--sea-ink-soft)]">
                    Current owner: {org.owner.name || org.owner.email} (
                    {org.owner.email})
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
