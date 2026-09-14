import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSession } from '../lib/auth-client'
import {
  currentReturnPath,
  isAuthRequiredPath,
  signInSearch,
} from '../lib/sign-in-redirect'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const navigate = useNavigate()
  const location = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      searchStr: state.location.searchStr,
      hash: state.location.hash,
    }),
  })
  const requiresAuth = isAuthRequiredPath(location.pathname)
  const signedIn = Boolean(session.data?.user)
  const ready = !session.isPending

  useEffect(() => {
    if (!requiresAuth || !ready || signedIn) return
    const redirect = currentReturnPath(
      location.pathname,
      location.searchStr,
      location.hash,
    )
    void navigate({
      to: '/sign-in',
      search: signInSearch(redirect),
      replace: true,
    })
  }, [
    location.hash,
    location.pathname,
    location.searchStr,
    navigate,
    ready,
    requiresAuth,
    signedIn,
  ])

  if (requiresAuth && (!ready || !signedIn)) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading…</p>
      </main>
    )
  }

  return children
}
