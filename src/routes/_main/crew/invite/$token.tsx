import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CrewAvatar } from '../../../../components/CrewAvatar'
import type { CrewInvitePreview } from '../../../../domain/crew'
import { signOutToSignIn, useSession } from '../../../../lib/auth-client'
import {
  acceptCrewInvite,
  fetchCrewInvitePreview,
} from '../../../../lib/crew-api'
import {
  buildInviteSignInSearch,
  normalizeEmailForCompare,
} from '../../../../lib/invite-auth-search'

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
  const autoAcceptStarted = useRef(false)

  const inviteRedirect = `/crew/invite/${token}`

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

  const handleAccept = useCallback(async () => {
    setAccepting(true)
    try {
      await acceptCrewInvite(token)
      setAccepted(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to accept invite')
    } finally {
      setAccepting(false)
    }
  }, [token])

  const emailMatches =
    Boolean(user && preview) &&
    normalizeEmailForCompare(user!.email) ===
      normalizeEmailForCompare(preview!.inviteeEmail)

  useEffect(() => {
    if (
      autoAcceptStarted.current ||
      !user ||
      !preview ||
      accepted ||
      accepting ||
      preview.expired ||
      preview.status !== 'PENDING' ||
      !emailMatches
    ) {
      return
    }
    autoAcceptStarted.current = true
    void handleAccept()
  }, [user, preview, accepted, accepting, emailMatches, handleAccept])

  const showSuccess =
    accepted ||
    (preview?.status === 'ACCEPTED' && Boolean(user) && emailMatches)

  const signUpSearch = buildInviteSignInSearch({
    redirect: inviteRedirect,
    email: preview?.inviteeEmail,
    mode: 'sign-up',
  })
  const signInSearch = buildInviteSignInSearch({
    redirect: inviteRedirect,
    email: preview?.inviteeEmail,
    mode: 'sign-in',
  })

  const handleAcceptAsNewUser = () => {
    const params = new URLSearchParams()
    params.set('redirect', inviteRedirect)
    if (preview?.inviteeEmail) params.set('email', preview.inviteeEmail)
    params.set('mode', 'sign-up')
    void signOutToSignIn(params.toString())
  }

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
        ) : showSuccess ? (
          <>
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              You&apos;re on the crew
            </h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              You have been added as{' '}
              <strong className="text-[var(--sea-ink)]">
                {preview.crewMemberName}
              </strong>{' '}
              on {preview.inviterName}&apos;s crew. They will need to accept
              your friend request before you appear as friends.
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
        ) : accepting ? (
          <>
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              Crew invite
            </h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">Accepting…</p>
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
              preview.inviteeHasAccount ? (
                <Link
                  to="/sign-in"
                  search={signInSearch}
                  className="inline-flex rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] no-underline"
                >
                  Sign in to accept
                </Link>
              ) : (
                <Link
                  to="/sign-in"
                  search={signUpSearch}
                  className="inline-flex rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] no-underline"
                >
                  Accept
                </Link>
              )
            ) : !emailMatches ? (
              preview.inviteeHasAccount ? (
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
                <div className="space-y-3">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    This invite was sent to {preview.inviteeEmail}. You&apos;re
                    signed in as {user.email}.
                  </p>
                  <button
                    type="button"
                    onClick={handleAcceptAsNewUser}
                    className="inline-flex rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)]"
                  >
                    Accept
                  </button>
                </div>
              )
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}
