import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react'
import { authClient } from '../../../lib/auth-client'

export const Route = createFileRoute('/_main/reset-password/')({
  component: ResetPassword,
})

function ResetPassword() {
  const [token, setToken] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    const err = params.get('error')
    if (err === 'INVALID_TOKEN') {
      toast.error('This reset link is invalid or has expired')
      setUrlError(err)
    }
    setToken(t)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !newPassword) {
      toast.error('Enter a new password')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const result = await authClient.resetPassword({ newPassword, token })
      if (result.error) {
        toast.error(result.error.message ?? 'Failed to reset password')
        return
      }
      setSuccess(true)
      toast.success('Password updated. You can sign in now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-base)] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-10">
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

        {!token && !urlError && (
          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              Reset password
            </h1>
            <p className="text-[var(--sea-ink-soft)] text-sm">
              Use the link from your email to reset your password. Links expire
              after a short time.
            </p>
            <Link
              to="/sign-in"
              search={{ forgot: '1' }}
              className="font-medium text-[var(--sea-ink)] underline decoration-[var(--sea-ink)]/40 underline-offset-2"
            >
              Request a new reset link
            </Link>
          </div>
        )}

        {urlError === 'INVALID_TOKEN' && (
          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              Invalid or expired link
            </h1>
            <p className="text-[var(--sea-ink-soft)] text-sm">
              This password reset link is invalid or has expired. Request a new
              one from the sign-in page.
            </p>
            <Link
              to="/sign-in"
              search={{ forgot: '1' }}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] no-underline hover:opacity-90"
            >
              Request new link
            </Link>
          </div>
        )}

        {success && (
          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
              Password reset
            </h1>
            <p className="text-[var(--sea-ink-soft)] text-sm">
              Your password has been updated. You can now sign in.
            </p>
            <Link
              to="/sign-in"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] no-underline hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        )}

        {token && !success && urlError !== 'INVALID_TOKEN' && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
                Set new password
              </h1>
              <p className="text-[var(--sea-ink-soft)] text-sm mt-1">
                Choose a new password for your account.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-[var(--sea-ink)] mb-1.5"
                >
                  New password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)]"
                    size={17}
                  />
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] text-sm outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-[var(--sea-ink)] mb-1.5"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)]"
                    size={17}
                  />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] text-sm outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm text-[var(--btn-text)] bg-[var(--btn-bg)] transition hover:opacity-90 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-block size-4 animate-spin rounded-full border-2 border-[var(--btn-text)]/30 border-t-[var(--btn-text)]" />
                ) : (
                  <>
                    <span>Reset password</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
            <p className="text-center">
              <Link
                to="/sign-in"
                className="text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
              >
                ← Back to sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
