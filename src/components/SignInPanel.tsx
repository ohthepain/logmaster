import { Link } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { authClient, signIn, signUp } from '../lib/auth-client'
import { passwordResetCallbackUrl } from '../lib/password-reset-url'
import {
  signInWithGoogleNative,
  supportsNativeGoogleSignIn,
} from '../lib/native/google-sign-in'
import { DevComponentLabel } from './DevComponentLabel'

type Tab = 'password' | 'magic'

type SignInPanelProps = {
  afterAuthPath?: string
  onAuthSuccess?: () => void
  embedded?: boolean
  initialForgotOpen?: boolean
}

export function SignInPanel({
  afterAuthPath = '/',
  onAuthSuccess,
  embedded = false,
  initialForgotOpen = false,
}: SignInPanelProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [tab, setTab] = useState<Tab>('password')
  const [forgotOpen, setForgotOpen] = useState(initialForgotOpen)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false)

  const finishAuth = useCallback(() => {
    if (onAuthSuccess) {
      onAuthSuccess()
      return
    }
    window.location.href = afterAuthPath
  }, [afterAuthPath, onAuthSuccess])

  const handleGoogleSignIn = useCallback(async () => {
    const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1')
    if (isLocalhost && publicAppUrl) {
      const target = new URL(publicAppUrl)
      if (target.origin !== window.location.origin) {
        const u = new URL(`${target.origin}/sign-in`, target.origin)
        u.searchParams.set('continue', 'google')
        if (afterAuthPath !== '/') {
          u.searchParams.set('redirect', afterAuthPath)
        }
        window.location.href = u.toString()
        return
      }
    }
    setLoading(true)
    try {
      if (supportsNativeGoogleSignIn()) {
        const signedIn = await signInWithGoogleNative(afterAuthPath)
        if (signedIn) {
          toast.success('Signed in')
          finishAuth()
        }
        return
      }

      const result = await signIn.social({
        provider: 'google',
        callbackURL: afterAuthPath,
      })
      if (result.error) {
        const message = result.error.message ?? 'Google sign in failed'
        toast.error(
          message.includes('ECONNREFUSED') || message.toLowerCase().includes('database')
            ? 'Sign-in server unavailable — is Postgres running?'
            : message,
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google sign in failed')
    } finally {
      setLoading(false)
    }
  }, [afterAuthPath, finishAuth])

  const openForgotPassword = () => {
    setForgotPasswordEmail(email.trim())
    setForgotPasswordSent(false)
    setForgotOpen(true)
  }

  const closeForgotPassword = () => {
    setForgotOpen(false)
    setForgotPasswordEmail('')
    setForgotPasswordSent(false)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'sign-in') {
        if (tab === 'password') {
          const result = await signIn.email({
            email,
            password,
            callbackURL: afterAuthPath,
          })
          if (result.error) {
            const st = (result.error as { status?: number }).status
            if (st === 403) {
              toast.error('Please verify your email first (check your inbox).')
            } else {
              toast.error(result.error.message ?? 'Sign in failed')
            }
            return
          }
          toast.success('Signed in')
          finishAuth()
        } else {
          const result = await signIn.magicLink({
            email,
            callbackURL: afterAuthPath,
          })
          if (result.error) {
            toast.error(result.error.message ?? 'Magic link failed')
            return
          }
          toast.success('Check your email for the sign-in link')
        }
      } else {
        const result = await signUp.email({
          email,
          password,
          name: name || email,
          callbackURL: afterAuthPath,
        })
        if (result.error) {
          toast.error(result.error.message ?? 'Sign up failed')
          return
        }
        toast.success(
          'Account created. Check your email to verify if required.',
        )
        setMode('sign-in')
        setTab('password')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotPasswordEmail.trim()) {
      toast.error('Enter your email')
      return
    }
    setForgotPasswordLoading(true)
    try {
      const redirectTo = passwordResetCallbackUrl(window.location.origin)
      const result = await authClient.requestPasswordReset({
        email: forgotPasswordEmail.trim(),
        redirectTo,
      })
      if (result.error) {
        toast.error(result.error.message ?? 'Failed to send reset link')
        return
      }
      setForgotPasswordSent(true)
      toast.success('Check your email for the reset link')
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const resendVerification = async () => {
    if (!email.trim()) {
      toast.error('Enter your email')
      return
    }
    setLoading(true)
    try {
      const result = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: afterAuthPath,
      })
      if (result.error) {
        toast.error(result.error.message ?? 'Could not send verification email')
        return
      }
      toast.success('Verification email sent')
    } finally {
      setLoading(false)
    }
  }

  const emailInputId = embedded ? 'ftue-email' : 'email'
  const passwordInputId = embedded ? 'ftue-password' : 'password'
  const nameInputId = embedded ? 'ftue-name' : 'name'

  return (
    <div className="w-full max-w-md">
      <DevComponentLabel name="SignInPanel" />
      <div className="mb-8">
        <h2
          className="text-[var(--sea-ink)] mb-2"
          style={{ fontSize: '1.875rem', fontWeight: 700 }}
        >
          {mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </h2>
        <p className="text-[var(--sea-ink-soft)]">
          {mode === 'sign-in' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="font-medium text-[var(--sea-ink)] underline"
                onClick={() => setMode('sign-up')}
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="font-medium text-[var(--sea-ink)] underline"
                onClick={() => setMode('sign-in')}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>

      {mode === 'sign-in' && (
        <>
          <button
            type="button"
            className="mb-6 w-full flex items-center justify-center gap-3 border border-[var(--line)] rounded-xl py-3 bg-[var(--chip-bg)] text-[var(--sea-ink)] text-sm font-medium hover:bg-[var(--link-bg-hover)] transition-colors disabled:opacity-60"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-[var(--line)]" />
            <span className="text-[var(--sea-ink-soft)] text-sm">
              or continue with email
            </span>
            <div className="flex-1 h-px bg-[var(--line)]" />
          </div>

          <div className="flex rounded-xl bg-[var(--chip-bg)] border border-[var(--line)] p-1 gap-1 mb-6">
            <button
              type="button"
              onClick={() => setTab('password')}
              className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                tab === 'password'
                  ? 'bg-[var(--btn-bg)] text-[var(--btn-text)]'
                  : 'text-[var(--sea-ink-soft)]'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setTab('magic')}
              className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                tab === 'magic'
                  ? 'bg-[var(--btn-bg)] text-[var(--btn-text)]'
                  : 'text-[var(--sea-ink-soft)]'
              }`}
            >
              Magic link
            </button>
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        {mode === 'sign-up' && (
          <div>
            <label
              htmlFor={nameInputId}
              className="block text-sm font-medium text-[var(--sea-ink)] mb-1.5"
            >
              Name
            </label>
            <input
              id={nameInputId}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="w-full px-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] text-sm outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20 focus:ring-offset-2"
            />
          </div>
        )}

        <div>
          <label
            htmlFor={emailInputId}
            className="block text-sm font-medium text-[var(--sea-ink)] mb-1.5"
          >
            Email
          </label>
          <div className="relative">
            <Mail
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)]"
              size={17}
            />
            <input
              id={emailInputId}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] text-sm outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
            />
          </div>
        </div>

        {(mode === 'sign-up' || tab === 'password') && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor={passwordInputId}
                className="block text-sm font-medium text-[var(--sea-ink)]"
              >
                Password
              </label>
              {mode === 'sign-in' && tab === 'password' && (
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] underline underline-offset-2"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)]"
                size={17}
              />
              <input
                id={passwordInputId}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required={mode === 'sign-up' || tab === 'password'}
                autoComplete={
                  mode === 'sign-in' ? 'current-password' : 'new-password'
                }
                minLength={mode === 'sign-up' ? 8 : undefined}
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
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm text-[var(--btn-text)] bg-[var(--btn-bg)] transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-[var(--btn-text)]/30 border-t-[var(--btn-text)]" />
          ) : mode === 'sign-in' && tab === 'magic' ? (
            <>
              <span>Send magic link</span>
              <ArrowRight size={16} />
            </>
          ) : (
            <>
              <span>
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {mode === 'sign-in' && tab === 'password' && (
        <p className="text-center text-sm text-[var(--sea-ink-soft)] mt-3">
          <button
            type="button"
            className="underline underline-offset-2 hover:text-[var(--sea-ink)]"
            onClick={resendVerification}
          >
            Resend verification email
          </button>
        </p>
      )}

      <p className="text-center text-xs text-[var(--sea-ink-soft)] mt-8">
        By continuing, you agree to our{' '}
        <Link
          to="/terms"
          className="underline underline-offset-2 hover:text-[var(--sea-ink)]"
        >
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link
          to="/privacy"
          className="underline underline-offset-2 hover:text-[var(--sea-ink)]"
        >
          Privacy Policy
        </Link>
        .
      </p>

      {!embedded && (
        <p className="text-center mt-4">
          <Link
            to="/"
            className="text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
          >
            ← Trips
          </Link>
        </p>
      )}

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') closeForgotPassword()
          }}
          onClick={closeForgotPassword}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="forgot-title"
              className="text-lg font-semibold text-[var(--sea-ink)] mb-1"
            >
              Forgot password
            </h2>
            <p className="text-sm text-[var(--sea-ink-soft)] mb-4">
              {forgotPasswordSent
                ? 'We sent a reset link to your email. Check your inbox and spam folder.'
                : 'Enter your email and we will send you a link to reset your password.'}
            </p>
            {!forgotPasswordSent ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label
                    htmlFor="forgot-password-email"
                    className="block text-sm font-medium text-[var(--sea-ink)] mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="forgot-password-email"
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] text-sm outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-semibold text-sm text-[var(--btn-text)] bg-[var(--btn-bg)] disabled:opacity-60"
                  disabled={forgotPasswordLoading}
                >
                  {forgotPasswordLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="w-full py-3 rounded-xl border border-[var(--line)] font-medium text-[var(--sea-ink)]"
                onClick={closeForgotPassword}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
