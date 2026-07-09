import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { authClient, signIn, signUp } from '../../lib/auth-client'
import { passwordResetCallbackUrl } from '../../lib/password-reset-url'
import ThemeToggle from '../../components/ThemeToggle'

const INTRO =
  'Logmaster keeps sailing trips, notes, and media local first. Sign in later if you want the same logbook synced across devices.'

function safeRedirectPath(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '/'
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return '/'
  try {
    const u = new URL(t, window.location.origin)
    if (u.origin !== window.location.origin) return '/'
    return u.pathname + u.search + u.hash
  } catch {
    return '/'
  }
}

type SignInSearch = { redirect?: string; forgot?: string }

export const Route = createFileRoute('/_main/sign-in')({
  validateSearch: (search: Record<string, unknown>): SignInSearch => {
    const r = search.redirect
    const forgot = search.forgot
    const out: SignInSearch = {}
    if (typeof r === 'string' && r.trim()) {
      const t = r.trim()
      if (t.startsWith('/') && !t.startsWith('//')) out.redirect = t
    }
    if (forgot === '1' || forgot === 'true') out.forgot = '1'
    return out
  },
  component: SignInPage,
})

type Tab = 'password' | 'magic'

function SignInPage() {
  const { redirect: redirectParam, forgot: forgotParam } = Route.useSearch()
  const afterAuthPath = useMemo(
    () => safeRedirectPath(redirectParam),
    [redirectParam],
  )

  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [tab, setTab] = useState<Tab>('password')
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false)

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
      const result = await signIn.social({
        provider: 'google',
        callbackURL: afterAuthPath,
      })
      if (result.error) {
        toast.error(result.error.message ?? 'Google sign in failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google sign in failed')
    } finally {
      setLoading(false)
    }
  }, [afterAuthPath])

  useEffect(() => {
    if (forgotParam === '1') {
      setMode('sign-in')
      setTab('password')
      setForgotOpen(true)
    }
  }, [forgotParam])

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('continue') === 'google') {
      params.delete('continue')
      const q = params.toString()
      window.history.replaceState(
        {},
        '',
        q ? `${window.location.pathname}?${q}` : window.location.pathname,
      )
      void handleGoogleSignIn()
    }
  }, [handleGoogleSignIn])

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
          window.location.href = afterAuthPath
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

  return (
    <div className="min-h-screen w-full flex">
      <div className="hidden lg:flex lg:w-1/3 flex-col justify-between p-12 relative overflow-hidden bg-[var(--btn-bg)] text-[var(--btn-text)]">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-5 bg-current" />
        <div className="absolute -bottom-32 -right-16 size-[28rem] rounded-full opacity-5 bg-current" />

        <Link
          to="/"
          className="text-sm opacity-60 hover:opacity-100 relative z-10 no-underline text-[var(--btn-text)]"
        >
          <div className="flex items-center gap-3">
            <img
              src="/logmaster_logo_transparent.png"
              alt=""
              className="w-10 h-10 rounded-xl"
              width={40}
              height={40}
            />
            <span className="font-semibold text-lg tracking-wide">
              logmaster
            </span>
          </div>
        </Link>

        <div className="relative z-10">
          <h1
            className="mb-4 text-[var(--btn-text)]"
            style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 }}
          >
            {mode === 'sign-in' ? 'Welcome back to' : 'Get started with'}
            <br />
            <span className="opacity-60">logmaster</span>
          </h1>
          <p className="max-w-xs opacity-70" style={{ lineHeight: 1.6 }}>
            {INTRO}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-4 text-sm">
          <Link
            to="/about"
            className="opacity-60 hover:opacity-100 transition-opacity underline underline-offset-2 text-[var(--btn-text)] no-underline hover:underline"
          >
            About
          </Link>
          <Link
            to="/terms"
            className="opacity-60 hover:opacity-100 transition-opacity underline underline-offset-2 text-[var(--btn-text)] no-underline hover:underline"
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            className="opacity-60 hover:opacity-100 transition-opacity underline underline-offset-2 text-[var(--btn-text)] no-underline hover:underline"
          >
            Privacy
          </Link>
        </div>
      </div>

      <div className="flex-1 flex min-w-0">
        <div className="flex-1 flex items-center justify-center bg-[var(--bg-base)] px-6 py-12">
          <div className="w-full max-w-md">
            <div className="flex lg:hidden items-center justify-between gap-3 mb-10">
              <div className="flex items-center gap-3">
                <img
                  src="/logmaster_logo_transparent.png"
                  alt=""
                  className="w-9 h-9 rounded-xl"
                  width={36}
                  height={36}
                />
                <span className="font-semibold text-lg text-[var(--sea-ink)]">
                  logmaster
                </span>
              </div>
              <ThemeToggle />
            </div>

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
                    htmlFor="name"
                    className="block text-sm font-medium text-[var(--sea-ink)] mb-1.5"
                  >
                    Name
                  </label>
                  <input
                    id="name"
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
                  htmlFor="email"
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
                    id="email"
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
                      htmlFor="password"
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
                      id="password"
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

            {mode === 'sign-in' && (
              <div className="mt-6">
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 border border-[var(--line)] rounded-xl py-3 bg-[var(--chip-bg)] text-[var(--sea-ink)] text-sm font-medium hover:bg-[var(--link-bg-hover)] transition-colors"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  Continue with Google
                </button>
              </div>
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

            <p className="text-center mt-4">
              <Link
                to="/"
                className="text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
              >
                ← Trips
              </Link>
            </p>

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
                          onChange={(e) =>
                            setForgotPasswordEmail(e.target.value)
                          }
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
        </div>
        <div className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:items-end lg:pt-6 lg:pr-6">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
