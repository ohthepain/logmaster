import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CrewAvatar } from '../../../components/CrewAvatar'
import type { MemberInvitePreview } from '../../../domain/member-invite'
import { signOutToSignIn, useSession } from '../../../lib/auth-client'
import {
  buildInviteSignInSearch,
  normalizeEmailForCompare,
} from '../../../lib/invite-auth-search'
import {
  acceptMemberInvite,
  fetchMemberInvitePreview,
} from '../../../lib/member-invites-api'

export const Route = createFileRoute('/_main/invite/$token')({
  component: MemberInvitePage,
})

function MemberInvitePage() {
  const { token } = Route.useParams()
  const session = useSession()
  const user = session.data?.user
  const [preview, setPreview] = useState<MemberInvitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoAcceptStarted = useRef(false)

  const inviteRedirect = `/invite/${token}`

  useEffect(() => {
    setLoading(true)
    setError(null)
    void fetchMemberInvitePreview(token)
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
      await acceptMemberInvite(token)
      setAccepted(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to accept invite')
    } finally {
      setAccepting(false)
    }
  }, [token])

  const emailMatches =
    !preview?.inviteeEmail ||
    (Boolean(user && preview) &&
      normalizeEmailForCompare(user!.email) ===
        normalizeEmailForCompare(preview.inviteeEmail))

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

  const targetLabel = preview?.kind === 'ORG' ? 'organization' : 'boat'
  const destination =
    preview?.kind === 'ORG' && preview.targetId
      ? { to: '/orgs/$orgId' as const, params: { orgId: preview.targetId } }
      : preview?.kind === 'BOAT' && preview.targetId
        ? {
            to: '/boats/$boatId' as const,
            params: { boatId: preview.targetId },
          }
        : null

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
          </>
        ) : !preview ? (
          <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
            Invite unavailable
          </h1>
        ) : showSuccess ? (
          <>
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              You&apos;re in
            </h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              You have been added to{' '}
              <strong className="text-[var(--sea-ink)]">
                {preview.targetName}
              </strong>
              .
            </p>
            {destination ? (
              <Link
                to={destination.to}
                params={destination.params}
                className="inline-flex rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] no-underline"
              >
                View {targetLabel}
              </Link>
            ) : null}
          </>
        ) : preview.expired || preview.status !== 'PENDING' ? (
          <>
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              Invite expired
            </h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              Ask {preview.inviterName} to send a new invite.
            </p>
          </>
        ) : accepting ? (
          <>
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              {preview.kind === 'ORG' ? 'Organization invite' : 'Boat invite'}
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
              {preview.kind === 'ORG' ? 'Organization invite' : 'Boat invite'}
            </h1>
            <p className="text-sm leading-7 text-[var(--sea-ink-soft)]">
              <strong className="text-[var(--sea-ink)]">
                {preview.inviterName}
              </strong>{' '}
              invited you to join{' '}
              <strong className="text-[var(--sea-ink)]">
                {preview.targetName}
              </strong>{' '}
              as {preview.role.toLowerCase()}.
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
