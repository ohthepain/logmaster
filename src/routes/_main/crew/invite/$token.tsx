import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CrewAvatar } from '../../../../components/CrewAvatar'
import type { CrewInvitePreview } from '../../../../domain/crew'
import { useSession } from '../../../../lib/auth-client'
import {
  acceptCrewInvite,
  fetchCrewInvitePreview,
} from '../../../../lib/crew-api'

export const Route = createFileRoute('/_main/crew/invite/$token')({
  component: CrewInvitePage,
})

function CrewInvitePage() {
  const { token } = Route.useParams()
  const session = useSession()
  const user = session.data?.user
  const [preview, setPreview] = useState<CrewInvitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    void fetchCrewInvitePreview(token)
      .then(setPreview)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Invite not found')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  const handleAccept = async () => {
    setAccepting(true)
    try {
      await acceptCrewInvite(token)
      setAccepted(true)
      toast.success('Crew invite accepted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to accept invite')
    } finally {
      setAccepting(false)
    }
  }

  const signInSearch = {
    redirect: `/crew/invite/${token}`,
  }

  const emailMatches =
    Boolean(user && preview) &&
    user!.email.trim().toLowerCase() === preview!.inviteeEmail.toLowerCase()

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-6 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <img
            src="/logmaster_logo_transparent.png"
            alt=""
            className="w-10 h-10 rounded-xl"
            width={40}
            height={40}
          />
          <span className="font-semibold text-lg text-[var(--sea-ink)]">
            logmaster
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--sea-ink-soft)]">Loading invite…</p>
        ) : error ? (
          <>
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              Invite unavailable
            </h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">{error}</p>
            <Link
              to="/crew"
              className="inline-flex rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] no-underline"
            >
              Go to Crew
            </Link>
          </>
        ) : !preview ? (
          <>
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              Invite unavailable
            </h1>
            <Link
              to="/crew"
              className="font-medium text-[var(--sea-ink)] underline underline-offset-2"
            >
              Go to Crew
            </Link>
          </>
        ) : accepted ? (
          <>
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              You&apos;re on the crew
            </h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              {preview.inviterName} will need to accept your friend request
              before you appear as friends.
            </p>
            <Link
              to="/crew"
              className="inline-flex rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] no-underline"
            >
              View Crew
            </Link>
          </>
        ) : preview.expired || preview.status !== 'PENDING' ? (
          <>
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              Invite expired
            </h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              Ask {preview.inviterName} to resend the invite from their Crew
              page.
            </p>
            <Link
              to="/crew"
              className="font-medium text-[var(--sea-ink)] underline underline-offset-2"
            >
              Go to Crew
            </Link>
          </>
        ) : (
          <>
            <CrewAvatar
              name={preview.inviterName}
              className="mx-auto size-20"
            />
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              Crew invite
            </h1>
            <p className="text-sm leading-7 text-[var(--sea-ink-soft)]">
              <strong className="text-[var(--sea-ink)]">
                {preview.inviterName}
              </strong>{' '}
              added you as{' '}
              <strong className="text-[var(--sea-ink)]">
                {preview.crewMemberName}
              </strong>{' '}
              on their crew. Accepting replaces their placeholder with your
              account profile. You won&apos;t become friends until they accept
              your connection request.
            </p>

            {!user ? (
              <Link
                to="/sign-in"
                search={signInSearch}
                className="inline-flex rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] no-underline"
              >
                Sign in to accept
              </Link>
            ) : !emailMatches ? (
              <div className="space-y-3">
                <p className="text-sm text-red-700 dark:text-red-300">
                  Sign in as {preview.inviteeEmail} to accept this invite.
                </p>
                <Link
                  to="/sign-in"
                  search={signInSearch}
                  className="inline-flex rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--sea-ink)] no-underline"
                >
                  Switch account
                </Link>
              </div>
            ) : (
              <button
                type="button"
                disabled={accepting}
                onClick={() => void handleAccept()}
                className="inline-flex rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
              >
                {accepting ? 'Accepting…' : 'Accept invite'}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  )
}
