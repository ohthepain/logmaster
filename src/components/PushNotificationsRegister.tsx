import { useEffect } from 'react'
import { toast } from 'sonner'
import { isNativePlatform, getNativePlatform } from '../lib/platform'
import { useSession } from '../lib/auth-client'
import {
  fetchNotificationDefaults,
  registerPushDevice,
  serializeWebPushSubscription,
  subscribeWebPush,
} from '../lib/notifications-api'

async function registerNativePush(): Promise<void> {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const platform = getNativePlatform()

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    toast.message(notification.title ?? 'Notification', {
      description: notification.body,
    })
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const linkUrl = action.notification.data?.linkUrl
    if (typeof linkUrl === 'string' && linkUrl.length > 0) {
      window.location.assign(linkUrl)
    }
  })

  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') {
    throw new Error('Push permission denied')
  }

  await PushNotifications.register()

  await new Promise<void>((resolve, reject) => {
    void PushNotifications.addListener('registration', (token) => {
      void registerPushDevice({
        platform: platform === 'ios' ? 'ios' : 'android',
        token: token.value,
      })
        .then(() => resolve())
        .catch(reject)
    })

    void PushNotifications.addListener('registrationError', (error) => {
      reject(new Error(error.error))
    })
  })
}

async function registerWebPush(): Promise<void> {
  const { defaults, webPushPublicKey } = await fetchNotificationDefaults()
  if (!defaults.push) return
  if (!webPushPublicKey) return

  const subscription = await subscribeWebPush(webPushPublicKey)
  if (!subscription) {
    throw new Error('Could not subscribe to web push')
  }

  const payload = serializeWebPushSubscription(subscription)
  await registerPushDevice(payload)
}

export function PushNotificationsRegister() {
  const session = useSession()
  const userId = session.data?.user?.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const run = async () => {
      try {
        if (isNativePlatform()) {
          await registerNativePush()
          return
        }
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
          return
        }
        await registerWebPush()
      } catch (error) {
        if (cancelled) return
        console.warn('[push] registration skipped', error)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (isNativePlatform()) return

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'PUSH_NOTIFICATION') return
      toast.message(event.data.title ?? 'Notification', {
        description: event.data.body,
      })
    }

    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [])

  return null
}

export async function enablePushOnDevice(): Promise<void> {
  if (isNativePlatform()) {
    await registerNativePush()
    toast.success('Push notifications enabled on this device')
    return
  }
  await registerWebPush()
  toast.success('Push notifications enabled in this browser')
}
