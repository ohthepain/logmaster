import { useEffect } from 'react'
import { apiJson } from '../lib/api-client'
import { getNativePlatform } from '../lib/platform'

/** Native app opens the landing saved when an invite was accepted on the web. */
export function InviteLandingRedirect() {
  useEffect(() => {
    if (getNativePlatform() === 'web') return
    if (window.location.pathname.includes('/invite/')) return
    let cancelled = false
    void (async () => {
      try {
        const data = await apiJson<{ path: string | null }>(
          '/api/profile/invite-landing',
        )
        if (cancelled || !data.path) return
        const here = `${window.location.pathname}${window.location.search}`
        if (here === data.path) {
          await apiJson('/api/profile/invite-landing/clear', { method: 'POST' })
          return
        }
        window.location.assign(data.path)
      } catch {
        // Signed out, or the landing column is not available yet.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
