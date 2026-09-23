import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Plus, Users } from 'lucide-react'
import { useSession } from '../lib/auth-client'
import { apiJson } from '../lib/api-client'
import {
  fetchConnections,
  connectionAction,
  openPrivateChat,
} from '../lib/connections-api'
import type { ConnectionPerson } from '../domain/connections'
import { CrewAvatar } from './CrewAvatar'
import { Modal } from './Modal'

export function ConnectionsPage({ add = false }: { add?: boolean }) {
  const user = useSession().data?.user
  const navigate = useNavigate()
  const [people, setPeople] = useState<ConnectionPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(add)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      setPeople(await fetchConnections())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load connections')
    } finally {
      setLoading(false)
    }
  }, [user?.id])
  useEffect(() => {
    void load()
  }, [load])
  async function run(work: () => Promise<unknown>) {
    setBusy(true)
    try {
      await work()
      await load()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not update connections',
      )
    } finally {
      setBusy(false)
    }
  }
  const button =
    'rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-semibold disabled:opacity-50'
  function card(person: ConnectionPerson) {
    const connected = person.connectionStatus === 'ACCEPTED'
    const pending = person.connectionStatus === 'PENDING'
    return (
      <article key={person.id} className="rounded-2xl bg-[var(--panel)] p-4">
        <div className="flex items-center gap-3">
          <CrewAvatar
            name={person.name}
            imageUrl={person.image}
            userId={person.id}
            className="size-12"
          />
          <div className="min-w-0">
            <p className="m-0 font-semibold">{person.name}</p>
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
              {person.contexts.join(' · ') ||
                (connected ? 'Connected' : 'Connection request')}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(connected || person.contexts.length > 0) && (
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const { threadId } = await openPrivateChat(person.id)
                  await navigate({
                    to: '/messages',
                    search: { thread: threadId },
                  })
                })
              }
            >
              Message
            </button>
          )}
          {person.incoming ? (
            <>
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(() => connectionAction(person.id, 'accept'))
                }
              >
                Accept connection
              </button>
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(() => connectionAction(person.id, 'decline'))
                }
              >
                Decline
              </button>
            </>
          ) : connected ? (
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove your connection with ${person.name}? Your private chat and shared trips will remain.`,
                  )
                )
                  void run(() => connectionAction(person.id, 'remove'))
              }}
            >
              Remove connection
            </button>
          ) : pending ? (
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(() => connectionAction(person.id, 'cancel'))
              }
            >
              Cancel request
            </button>
          ) : (
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(() => connectionAction(person.id, 'request'))
              }
            >
              Connect
            </button>
          )}
        </div>
      </article>
    )
  }
  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4">
      <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="brand-title m-0 whitespace-nowrap text-3xl sm:text-4xl">
          Connections
        </h1>
        {user && (
          <button className={button} onClick={() => setInviteOpen(true)}>
            <Plus className="mr-1 inline size-4" />
            Invite to connect
          </button>
        )}
      </div>
      <p className="text-[var(--sea-ink-soft)]">
        Save connections to keep in touch. You can also message people on your
        boats and consortia.
      </p>
      {!user ? (
        <Link to="/sign-in" search={{ redirect: '/connections' }}>
          Sign in to connect
        </Link>
      ) : loading ? (
        <p>Loading connections…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          {people.some((p) => p.incoming) && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold">Requests for you</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {people.filter((p) => p.incoming).map(card)}
              </div>
            </section>
          )}
          <section className="mt-8">
            <h2 className="text-xl font-semibold">Your connections</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {people
                .filter((p) => p.connectionStatus === 'ACCEPTED')
                .map(card)}
            </div>
            {!people.some((p) => p.connectionStatus === 'ACCEPTED') && (
              <p className="rounded-2xl bg-[var(--panel)] p-6">
                <Users className="mb-2 size-6" />
                No connections yet. Invite someone or connect with a fellow
                member.
              </p>
            )}
          </section>
          {people.some(
            (p) => p.connectionStatus === 'PENDING' && !p.incoming,
          ) && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold">Sent requests</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {people
                  .filter(
                    (p) => p.connectionStatus === 'PENDING' && !p.incoming,
                  )
                  .map(card)}
              </div>
            </section>
          )}
          {people.some((p) => p.contexts.length && !p.connectionStatus) && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold">
                People on your boats and consortia
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {people
                  .filter((p) => p.contexts.length && !p.connectionStatus)
                  .map(card)}
              </div>
            </section>
          )}
        </>
      )}
      {inviteOpen && (
        <Modal title="Invite to connect" onClose={() => setInviteOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                await apiJson('/api/connections/invite', {
                  method: 'POST',
                  body: JSON.stringify({ email }),
                })
                setInviteOpen(false)
                setEmail('')
                toast.success('Connection invitation sent')
              })
            }}
          >
            <p>
              They can accept your invitation using an existing account or sign
              up first.
            </p>
            <label className="block">
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3"
              />
            </label>
            <button type="submit" disabled={busy} className={`${button} mt-4`}>
              {busy ? 'Sending…' : 'Send invitation'}
            </button>
          </form>
        </Modal>
      )}
    </main>
  )
}
