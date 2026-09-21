import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { apiJson } from '../lib/api-client'
import { createChatRealtime } from '../lib/messaging/realtime'
import type { ChatRealtime } from '../lib/messaging/realtime'

/** Mounted only by the chat page. Covers web visibility, native suspension, and logout. */
export function useChatActivity(
  userId: string | undefined,
  refresh: () => void,
) {
  const [active, setActive] = useState(false)
  const [live, setLive] = useState(false)
  useEffect(() => {
    let nativeActive = true
    let disposed = false
    const update = () => {
      if (!disposed) setActive(!document.hidden && nativeActive)
    }
    update()
    document.addEventListener('visibilitychange', update)
    const listener = Capacitor.isNativePlatform()
      ? App.addListener('appStateChange', (state) => {
          nativeActive = state.isActive
          update()
        })
      : null
    if (Capacitor.isNativePlatform())
      void App.getState().then((state) => {
        nativeActive = state.isActive
        update()
      })
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', update)
      void listener?.then((handle) => handle.remove())
    }
  }, [])

  useEffect(() => {
    if (!active || !userId) {
      setLive(false)
      return
    }
    let stopped = false
    let realtime: ChatRealtime | undefined
    const sessionId = crypto.randomUUID()
    const presence = (value: boolean) =>
      apiJson('/api/messaging/presence', {
        method: 'POST',
        body: JSON.stringify({ sessionId, active: value }),
        keepalive: !value,
      }).catch(() => {})
    const heartbeat = setInterval(() => {
      void presence(true)
    }, 15000)
    const fallback = setInterval(refresh, 15000)
    void presence(true)
    refresh()
    void createChatRealtime()
      .then(async (adapter) => {
        realtime = adapter
        if (stopped) {
          await adapter.disconnect()
          return
        }
        await adapter.connect(refresh)
        if (!stopped) setLive(true)
      })
      .catch(() => {
        if (!stopped) setLive(false)
      })
    return () => {
      stopped = true
      clearInterval(heartbeat)
      clearInterval(fallback)
      void presence(false)
      void realtime?.disconnect().catch(() => {})
    }
  }, [active, userId, refresh])
  return { active, live }
}
