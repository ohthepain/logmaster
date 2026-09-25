import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  deleteAdminUser,
  fetchAdminUsers,
  setAdminUserPlatformAdmin,
} from '../../../lib/admin-api'
import type { AdminUser } from '../../../lib/admin-api'
import { useSession } from '../../../lib/auth-client'
import { useIsAdmin } from '../../../lib/use-admin'

export const Route = createFileRoute('/_main/admin/users')({
  component: AdminUsersPage,
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

function AdminUsersPage() {
  const session = useSession()
  const navigate = useNavigate()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const currentUserId = session.data?.user?.id
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [adminToggleId, setAdminToggleId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      setUsers(await fetchAdminUsers())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (adminLoading || session.isPending) return
    if (!session.data?.user) return
    if (!isAdmin) {
      void navigate({ to: '/' })
      return
    }
    void load()
  }, [
    adminLoading,
    isAdmin,
    load,
    navigate,
    session.data?.user,
    session.isPending,
  ])

  const handlePlatformAdmin = async (user: AdminUser, grant: boolean) => {
    if (
      !grant &&
      !window.confirm(
        `Revoke platform admin access for "${user.name || user.email}"?`,
      )
    ) {
      return
    }

    setAdminToggleId(user.id)
    try {
      const updated = await setAdminUserPlatformAdmin(user.id, grant)
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      toast.success(
        grant
          ? 'Platform admin access granted'
          : 'Platform admin access revoked',
      )
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to update platform admin',
      )
    } finally {
      setAdminToggleId(null)
    }
  }

  const handleDelete = async (user: AdminUser) => {
    if (
      !window.confirm(
        `Delete user "${user.name || user.email}"? Their boats, crew, and sessions will also be removed.`,
      )
    ) {
      return
    }

    setDeletingId(user.id)
    try {
      await deleteAdminUser(user.id)
      setUsers((current) => current.filter((item) => item.id !== user.id))
      toast.message('User deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete user')
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
          Users
        </h1>
        <p className="m-0 mb-2 text-sm text-[var(--sea-ink-soft)]">
          <Link
            to="/admin"
            className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
          >
            ← Admin
          </Link>
        </p>
        <p className="m-0 mb-4 text-sm text-[var(--sea-ink-soft)]">
          Grant global platform admin access (Admin menu, jobs, and related
          tools). Users on the <code className="text-xs">ADMIN_EMAILS</code> env
          allowlist cannot be revoked from here.
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
            {users.length === 0 && (
              <li className="py-4 text-[var(--sea-ink-soft)]">No users yet.</li>
            )}
            {users.map((user) => {
              const isSelf = user.id === currentUserId
              const busyDelete = deletingId === user.id
              const busyAdmin = adminToggleId === user.id
              const canRevokeDbAdmin = user.platformAdminAt != null && !isSelf
              const canGrantAdmin = !user.isPlatformAdmin
              const envOnlyAdmin =
                user.isPlatformAdmin &&
                user.envAdminAllowlist &&
                !user.platformAdminAt
              return (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--header-bg)]/40 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate font-semibold text-[var(--sea-ink)]">
                      {user.name || user.email}
                      {isSelf ? (
                        <span className="ml-2 text-xs font-normal text-[var(--sea-ink-soft)]">
                          (you)
                        </span>
                      ) : null}
                      {user.isPlatformAdmin ? (
                        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
                          Platform admin
                        </span>
                      ) : null}
                    </p>
                    <p className="m-0 mt-0.5 text-sm text-[var(--sea-ink-soft)]">
                      {user.email}
                      {user.emailVerified ? ' · verified' : ' · unverified'} ·
                      joined {formatDate(user.createdAt)}
                      {envOnlyAdmin ? ' · env allowlist' : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canGrantAdmin ? (
                      <button
                        type="button"
                        disabled={busyAdmin || busyDelete}
                        onClick={() => void handlePlatformAdmin(user, true)}
                        className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--sea-ink)] disabled:opacity-60"
                      >
                        {busyAdmin ? 'Saving…' : 'Make platform admin'}
                      </button>
                    ) : null}
                    {canRevokeDbAdmin ? (
                      <button
                        type="button"
                        disabled={busyAdmin || busyDelete}
                        onClick={() => void handlePlatformAdmin(user, false)}
                        className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--sea-ink)] disabled:opacity-60"
                      >
                        {busyAdmin ? 'Saving…' : 'Revoke platform admin'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyDelete || busyAdmin || isSelf}
                      title={
                        isSelf
                          ? 'You cannot delete your own account here'
                          : undefined
                      }
                      onClick={() => void handleDelete(user)}
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                    >
                      {busyDelete ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
