import type { ChatSession } from '../../domain/messaging'
import { apiJson } from '../api-client'

export interface ChatRealtime {
  connect: (onMessage: () => void) => Promise<void>
  disconnect: () => Promise<void>
}
export async function createChatRealtime(): Promise<ChatRealtime> {
  const session = await apiJson<ChatSession>('/api/messaging/session', {
    method: 'POST',
  })
  if (session.provider === 'polling')
    return { async connect() {}, async disconnect() {} }
  const { createStreamRealtime } = await import('./stream-realtime')
  return createStreamRealtime(session)
}
