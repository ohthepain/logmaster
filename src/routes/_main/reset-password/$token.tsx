import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  passwordResetCallbackUrl,
  passwordResetEmailUrl,
} from '../../../lib/password-reset-url'

/** Handles legacy Better Auth email links: /reset-password/:token?callbackURL=… */
export const Route = createFileRoute('/_main/reset-password/$token')({
  component: ResetPasswordTokenRedirect,
})

function ResetPasswordTokenRedirect() {
  const { token } = Route.useParams()

  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const callbackURL =
      search.get('callbackURL') ??
      passwordResetCallbackUrl(window.location.origin)
    window.location.replace(
      passwordResetEmailUrl({
        origin: window.location.origin,
        token,
        redirectTo: callbackURL,
      }),
    )
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <p className="text-sm text-[var(--sea-ink-soft)]">Redirecting…</p>
    </div>
  )
}
