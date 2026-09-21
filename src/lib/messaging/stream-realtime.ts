import { StreamChat } from 'stream-chat'
import { apiJson } from '../api-client'
import type { ChatSession } from '../../domain/messaging'
import type { ChatRealtime } from './realtime'

declare module 'stream-chat' {
  interface CustomMessageData {
    logmaster?: {
      version: number
      message_id: string
      thread_id: string
      response_card: { version: number; type: string } | null
    }
  }
}

export function createStreamRealtime(
  session: Extract<ChatSession, { provider: 'stream' }>,
): ChatRealtime {
  const client = new StreamChat(session.apiKey)
  let stopped = false
  let initialToken = true
  let connecting: Promise<unknown> | undefined
  return {
    async connect(onMessage) {
      connecting = client.connectUser({ id: session.userId }, async () => {
        if (stopped) throw new Error('Chat closed')
        if (initialToken) {
          initialToken = false
          return session.token
        }
        const refreshed = await apiJson<ChatSession>('/api/messaging/session', {
          method: 'POST',
        })
        if (refreshed.provider !== 'stream')
          throw new Error('Messaging provider changed')
        return refreshed.token
      })
      await connecting
      if (stopped) {
        await client.disconnectUser()
        return
      }
      client.on('message.new', onMessage)
      client.on('connection.recovered', onMessage)
      await client
        .channel(session.channelType, session.channelId)
        .watch({ messages: { limit: 0 } })
      onMessage() // Catch anything sent during initial connection.
    },
    async disconnect() {
      stopped = true
      try {
        await connecting
      } catch {
        /* A failed connection still needs cleanup. */
      }
      await client.disconnectUser()
    },
  }
}
