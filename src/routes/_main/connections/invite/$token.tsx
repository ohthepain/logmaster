import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSession } from '../../../../lib/auth-client'
import { apiJson } from '../../../../lib/api-client'

export const Route = createFileRoute('/_main/connections/invite/$token')({
  component: Page,
})
function Page() {
  const { token } = Route.useParams()
  const user = useSession().data?.user
  const [preview, setPreview] = useState<{
    inviterName: string
    status: string
    expired: boolean
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [notifyOnInviterTripStart, setNotifyOnInviterTripStart] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void apiJson<typeof preview>(
      `/api/connections/invites/${encodeURIComponent(token)}`,
    )
      .then(setPreview)
      .catch((e) => setError(e.message))
  }, [token])
  async function accept() {
    setBusy(true)
    try {
      await apiJson(
        `/api/connections/invites/${encodeURIComponent(token)}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({ notifyOnInviterTripStart }),
        },
      )
      setAccepted(true)
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
      {accepted ? (
        <>
          <p>
            You are now connected. Your connection lasts beyond any boat,
            consortium, or trip.
          </p>
          <Link to="/connections">View connections</Link>
        </>
      ) : preview ? (
        preview.expired || preview.status !== 'PENDING' ? (
          <p>This invitation is no longer available.</p>
        ) : (
          <>
            <p>{preview.inviterName} invited you to connect.</p>
            <p>Accept to save a lasting connection and message each other.</p>
            {user ? (
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
            ) : (
              <Link
                to="/sign-in"
                search={{ redirect: `/connections/invite/${token}` }}
              >
                Sign in or create an account to accept
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
