import type { ChatSession } from '../../domain/messaging'

export type MessageSignal = {
  messageId: string
  threadId: string
  senderId: string
  recipientId: string
  // Versioned custom fields for future response cards; the database owns payloads.
  responseCard: { version: 1; type: string } | null
}
export interface MessagingProvider {
  session: (user: { id: string; name: string }) => Promise<ChatSession>
  publish: (signal: MessageSignal) => Promise<void>
  verifyWebhook: (body: string, signature: string) => boolean
}
export async function getMessagingProvider(): Promise<MessagingProvider | null> {
  if (process.env.MESSAGING_PROVIDER === 'polling') return null
  if (
    !process.env.STREAM_API_KEY?.trim() ||
    !process.env.STREAM_API_SECRET?.trim()
  )
    return null
  const { streamProvider } = await import('./stream-provider')
  return streamProvider
}
