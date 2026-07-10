import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_MS = 60 * 60 * 1000

export function PwaRegister() {
  const toastIdRef = useRef<string | number | null>(null)

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegistered(registration) {
      if (!registration) return
      window.setInterval(() => {
        void registration.update()
      }, UPDATE_CHECK_MS)
    },
    onRegisterError(error) {
      console.warn('[pwa] service worker registration failed', error)
    },
  })

  useEffect(() => {
    if (!offlineReady) return

    toastIdRef.current = toast.message('logmaster is ready offline', {
      description: 'Trips and logs stay on this device when you lose signal.',
      duration: 5000,
    })
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady])

  useEffect(() => {
    if (!needRefresh) return

    if (toastIdRef.current != null) {
      toast.dismiss(toastIdRef.current)
    }

    toastIdRef.current = toast.message('Update available', {
      description: 'A new version of logmaster is ready.',
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: () => {
          void updateServiceWorker(true)
        },
      },
      cancel: {
        label: 'Later',
        onClick: () => {
          setNeedRefresh(false)
        },
      },
    })
  }, [needRefresh, setNeedRefresh, updateServiceWorker])

  return null
}
