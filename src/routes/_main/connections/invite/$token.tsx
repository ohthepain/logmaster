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
        { method: 'POST' },
      )
      setAccepted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept invitation')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="page-wrap max-w-xl px-4 py-8">
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
              <button
                disabled={busy}
                onClick={() => void accept()}
                className="rounded-full bg-[var(--btn-bg)] px-5 py-3 text-[var(--btn-text)]"
              >
                Accept invitation
              </button>
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
