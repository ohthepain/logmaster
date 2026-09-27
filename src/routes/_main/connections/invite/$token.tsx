import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ExpiredInviteContinue } from '../../../../components/ExpiredInviteContinue'
import { useSession } from '../../../../lib/auth-client'
import { apiJson } from '../../../../lib/api-client'
import {
  buildInviteSignInSearch,
  normalizeEmailForCompare,
} from '../../../../lib/invite-auth-search'

export const Route = createFileRoute('/_main/connections/invite/$token')({
  component: Page,
})
function Page() {
  const { token } = Route.useParams()
  const user = useSession().data?.user
  const [preview, setPreview] = useState<{
    inviterName: string
    inviteeEmail: string
    inviteeHasAccount: boolean
    status: string
    expired: boolean
    landingPath?: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notifyOnInviterTripStart, setNotifyOnInviterTripStart] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void apiJson<typeof preview>(
      `/api/connections/invites/${encodeURIComponent(token)}`,
    )
      .then(setPreview)
      .catch((e) => setError(e.message))
  }, [token])
  const emailMatches =
    Boolean(user && preview) &&
    normalizeEmailForCompare(user!.email) ===
      normalizeEmailForCompare(preview!.inviteeEmail)
  useEffect(() => {
    if (emailMatches && preview?.status === 'ACCEPTED' && preview.landingPath) {
      window.location.assign(preview.landingPath)
    }
  }, [emailMatches, preview])
  async function accept() {
    setBusy(true)
    try {
      const result = await apiJson<{ landingPath: string }>(
        `/api/connections/invites/${encodeURIComponent(token)}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({ notifyOnInviterTripStart }),
        },
      )
      window.location.assign(result.landingPath)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept invitation')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="page-wrap mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-4 py-8">
      <h1 className="brand-title text-3xl">Connect on Logmaster</h1>
      {error && <p role="alert">{error}</p>}
      {preview ? (
        preview.status === 'PENDING' && preview.expired ? (
          <>
            <h2 className="mt-6 text-xl font-semibold">Invite expired</h2>
            <div className="mt-4">
              <ExpiredInviteContinue email={preview.inviteeEmail} />
            </div>
          </>
        ) : preview.expired || preview.status !== 'PENDING' ? (
          <p>This invitation is no longer available.</p>
        ) : (
          <>
            <p>{preview.inviterName} invited you to connect.</p>
            <p>Accept to save a lasting connection and message each other.</p>
            {user && !emailMatches ? (
              <div className="mt-4 space-y-3">
                <p>
                  You&apos;re signed in as {user.email}. This invite stays
                  pending for {preview.inviteeEmail}.
                </p>
                <Link to="/">Continue</Link>
              </div>
            ) : user ? (
              <form
                className="mt-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void accept()
                }}
              >
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={notifyOnInviterTripStart}
                    onChange={(event) =>
                      setNotifyOnInviterTripStart(event.target.checked)
                    }
                  />
                  <span>
                    Notify me when {preview.inviterName} starts a trip
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-4 rounded-full bg-[var(--btn-bg)] px-5 py-3 text-[var(--btn-text)]"
                >
                  Accept invitation
                </button>
              </form>
            ) : preview.inviteeHasAccount ? (
              <Link
                to="/sign-in"
                search={buildInviteSignInSearch({
                  redirect: `/connections/invite/${token}`,
                  email: preview.inviteeEmail,
                  mode: 'sign-in',
                })}
              >
                Sign in to accept
              </Link>
            ) : (
              <Link
                to="/sign-in"
                search={buildInviteSignInSearch({
                  redirect: `/connections/invite/${token}`,
                  email: preview.inviteeEmail,
                  mode: 'sign-up',
                })}
              >
                Accept
              </Link>
            )}
          </>
        )
      ) : (
        !error && <p>Loading invitation…</p>
      )}
    </main>
  )
}
