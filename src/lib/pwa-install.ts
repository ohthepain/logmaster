import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isIosSafari(): boolean {
  if (!isIosDevice() || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())
  const isIos = isIosDevice()

  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const canInstall = !installed && (deferredPrompt != null || isIos)

  const promptInstall = async () => {
    if (installed) {
      toast.message('logmaster is already on your home screen')
      return
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setInstalled(true)
        setDeferredPrompt(null)
        toast.success('Added to home screen')
      }
      return
    }
    if (isIos) {
      toast.message('Tap Share, then Add to Home Screen', {
        description: 'Use Safari’s share menu to install logmaster.',
        duration: 6000,
      })
      return
    }
    toast.message('Install not available yet', {
      description:
        'Open logmaster in Chrome or Edge on your phone or desktop to add it to your home screen.',
      duration: 5000,
    })
  }

  return { canInstall, installed, promptInstall, isIos, isIosSafari: isIosSafari() }
}
