import { useEffect, useState } from 'react'
import { useSession } from './auth-client'
import { fetchAdminStatus } from './admin-api'

export function useIsAdmin() {
  const session = useSession()
  const userId = session.data?.user?.id
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session.isPending) return

    if (!userId) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetchAdminStatus()
      .then((data) => {
        if (!cancelled) setIsAdmin(data.admin)
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session.isPending, userId])

  return { isAdmin, loading }
}
