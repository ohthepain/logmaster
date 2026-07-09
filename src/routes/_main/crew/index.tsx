import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus, UserCheck, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AddCrewMemberModal } from '../../../components/AddCrewMemberModal'
import { CrewAvatar } from '../../../components/CrewAvatar'
import { CrewMemberModal } from '../../../components/CrewMemberModal'
import type { CrewMember, CrewPayload } from '../../../domain/crew'
import { useSession } from '../../../lib/auth-client'
import {
  acceptCrewInvite,
  acceptFriendRequest,
  declineFriendRequest,
  fetchCrew,
} from '../../../lib/crew-api'

type CrewSearch = { addCrew?: boolean }

export const Route = createFileRoute('/_main/crew/')({
  validateSearch: (search: Record<string, unknown>): CrewSearch => {
    const value = search.addCrew
    if (value === true || value === 'true' || value === '1' || value === 1) {
      return { addCrew: true }
    }
    return {}
  },
  component: CrewPage,
})

function CrewPage() {
  const session = useSession()
  const navigate = useNavigate()
  const { addCrew: addCrewSearch } = Route.useSearch()
  const user = session.data?.user
  const [data, setData] = useState<CrewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await fetchCrew())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load crew')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!addCrewSearch || !user) return
    setAddOpen(true)
    void navigate({ to: '/crew', search: {}, replace: true })
  }, [addCrewSearch, user, navigate])

  const handleMemberUpdated = async () => {
    const refreshed = await fetchCrew()
    setData(refreshed)
    if (selectedMember) {
      const updated = refreshed.members.find((m) => m.id === selectedMember.id)
      if (updated) setSelectedMember(updated)
    }
  }

  const handleAcceptCrewInvite = async (token: string) => {
    setBusyId(token)
    try {
      await acceptCrewInvite(token)
      toast.success('Crew invite accepted')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to accept invite')
    } finally {
      setBusyId(null)
    }
  }

  const handleAcceptFriend = async (requestId: string) => {
    setBusyId(requestId)
    try {
      await acceptFriendRequest(requestId)
      toast.success('Friend added')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to accept request')
    } finally {
      setBusyId(null)
    }
  }

  const handleDeclineFriend = async (requestId: string) => {
    setBusyId(requestId)
    try {
      await declineFriendRequest(requestId)
      toast.success('Request declined')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to decline request')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="pb-24 pt-2">
      <div className="page-wrap px-3 sm:px-4">
        <div className="mb-6 flex items-center justify-between gap-3 pt-2">
          <h1 className="brand-title m-0 text-[2.35rem] leading-none sm:text-[2.75rem]">
            Crew
          </h1>
          {user && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
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
              Sign in to build your crew and connect with sailing friends.
            </p>
            <Link
              to="/sign-in"
              search={{ redirect: '/crew' }}
              className="brand-emphasis mt-4 inline-flex text-sm font-semibold no-underline hover:text-[var(--brand-hover)]"
            >
              Sign in
            </Link>
          </section>
        </div>
      ) : loading ? (
        <div className="page-wrap px-3 sm:px-4">
          <p className="text-sm text-[var(--sea-ink-soft)]">Loading crew…</p>
        </div>
      ) : error ? (
        <div className="page-wrap px-3 sm:px-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : (
        <div className="page-wrap space-y-10 px-3 sm:px-4">
          {data?.incomingCrewInvites.length ? (
            <Section
              title="Crew invites for you"
              subtitle="Accept to join someone's crew list. You won't become friends until they accept your connection request."
            >
              <div className="space-y-3">
                {data.incomingCrewInvites.map((invite) => (
                  <article
                    key={invite.id}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4"
                  >
                    <CrewAvatar
                      name={invite.inviter.name}
                      imageUrl={invite.inviter.image}
                      userId={invite.inviter.id}
                      className="size-14"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 font-semibold text-[var(--sea-ink)]">
                        {invite.inviter.name}
                      </p>
                      <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
                        Invited you as crew ({invite.crewMemberName})
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === invite.token}
                      onClick={() => void handleAcceptCrewInvite(invite.token)}
                      className="inline-flex rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
                    >
                      Accept
                    </button>
                  </article>
                ))}
              </div>
            </Section>
          ) : null}

          {data?.incomingFriendRequests.length ? (
            <Section
              title="Friend requests"
              subtitle="Someone accepted your crew invite and wants to connect."
            >
              <div className="space-y-3">
                {data.incomingFriendRequests.map((request) => (
                  <article
                    key={request.id}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4"
                  >
                    <CrewAvatar
                      name={request.requester.name}
                      imageUrl={request.requester.image}
                      userId={request.requester.id}
                      className="size-14"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 font-semibold text-[var(--sea-ink)]">
                        {request.requester.name}
                      </p>
                      <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
                        Wants to be friends on logmaster
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === request.id}
                        onClick={() => void handleAcceptFriend(request.id)}
                        className="inline-flex rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busyId === request.id}
                        onClick={() => void handleDeclineFriend(request.id)}
                        className="inline-flex rounded-full border border-[var(--chip-line)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          ) : null}

          <Section
            title="Friends"
            subtitle="People you've mutually connected with."
          >
            {data?.friends.length ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {data.friends.map((friend) => (
                  <article
                    key={friend.id}
                    className="rounded-2xl bg-[var(--panel)] p-4 text-center"
                  >
                    <CrewAvatar
                      name={friend.name}
                      imageUrl={friend.image}
                      userId={friend.id}
                      className="mx-auto size-20"
                    />
                    <p className="m-0 mt-3 truncate text-sm font-semibold text-[var(--sea-ink)]">
                      {friend.name}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon={UserCheck} message="No friends yet. Accept a friend request after someone joins your crew." />
            )}
          </Section>

          <Section
            title="Your crew"
            subtitle="Local placeholders and linked sailors on your roster."
          >
            {data?.members.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {data.members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMember(member)}
                    className="flex w-full items-center gap-4 rounded-2xl bg-[var(--panel)] p-4 text-left transition hover:bg-[var(--chip-bg)]"
                  >
                    <CrewAvatar
                      name={member.name}
                      imageUrl={member.imageUrl}
                      className="size-16"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate font-semibold text-[var(--sea-ink)]">
                        {member.name}
                      </p>
                      {member.email && (
                        <p className="m-0 mt-1 truncate text-sm text-[var(--sea-ink-soft)]">
                          {member.email}
                        </p>
                      )}
                      <p className="m-0 mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--kicker)]">
                        {member.isFriend
                          ? 'Friend'
                          : member.isLinked
                            ? 'Connected'
                            : member.pendingInvite
                              ? 'Invite pending'
                              : 'Local'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                message="Add crew by name and photo. Include an email to send an invite."
                action={
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)]"
                  >
                    <Plus className="size-4" />
                    Add crew member
                  </button>
                }
              />
            )}
          </Section>
        </div>
      )}

      <AddCrewMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => void load()}
      />

      <CrewMemberModal
        member={selectedMember}
        open={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        onUpdated={() => void handleMemberUpdated()}
        onDeleted={() => void load()}
      />
    </main>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="m-0 text-xl font-bold text-[var(--sea-ink)]">{title}</h2>
        <p className="m-0 mt-1 max-w-2xl text-sm leading-6 text-[var(--sea-ink-soft)]">
          {subtitle}
        </p>
      </div>
      {children}
    </section>
  )
}

function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: typeof Users
  message: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-[var(--panel)] px-6 py-10 text-center">
      <Icon className="mx-auto size-8 text-[var(--sea-ink-soft)]" strokeWidth={1.75} />
      <p className="m-0 mt-3 text-sm text-[var(--sea-ink-soft)]">{message}</p>
      {action}
    </div>
  )
}
