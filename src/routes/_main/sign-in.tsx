import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo } from 'react'
import { signIn } from '../../lib/auth-client'
import ThemeToggle from '../../components/ThemeToggle'
import { SignInPanel } from '../../components/SignInPanel'

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

function SignInPage() {
  const { redirect: redirectParam, forgot: forgotParam } = Route.useSearch()
  const afterAuthPath = useMemo(
    () => safeRedirectPath(redirectParam),
    [redirectParam],
  )

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
    await signIn.social({
      provider: 'google',
      callbackURL: afterAuthPath,
    })
  }, [afterAuthPath])

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
            Welcome back to
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
        <div className="flex-1 flex min-h-0 flex-col overflow-y-auto bg-[var(--bg-base)] px-6 pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] lg:justify-center lg:py-12">
          <div className="w-full max-w-md mx-auto flex min-h-0 flex-1 flex-col lg:flex-none lg:block">
            <div className="flex lg:hidden items-center justify-between gap-3 py-4 shrink-0">
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

            <div className="flex flex-1 items-start py-6 min-h-0 lg:items-center lg:py-0">
              <SignInPanel
                afterAuthPath={afterAuthPath}
                initialForgotOpen={forgotParam === '1'}
              />
            </div>
          </div>
        </div>
        <div className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:items-end lg:pt-6 lg:pr-6">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
