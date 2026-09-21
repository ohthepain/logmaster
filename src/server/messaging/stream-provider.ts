import { createHash } from 'node:crypto'
import { StreamChat } from 'stream-chat'
import type { MessagingProvider } from './provider'

const CHANNEL_TYPE = 'logmaster_events'
let client: StreamChat | undefined
function stream() {
  if (!client) {
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET)
      throw new Error('Stream is not configured')
    client = new StreamChat(
      process.env.STREAM_API_KEY.trim(),
      process.env.STREAM_API_SECRET.trim(),
    )
  }
  return client
}
const channelId = (userId: string) =>
  createHash('sha256').update(userId).digest('hex')

/** Run explicitly during deployment; never grant clients authority over relationships. */
export async function configureStream() {
  const api = stream()
  const config = {
    push_notifications: false,
    message_retention: '7d',
    connect_events: false,
    typing_events: false,
    read_events: false,
    reactions: false,
    replies: false,
    grants: {
      user: [],
      guest: [],
      anonymous: [],
      channel_member: ['read-channel'],
      channel_moderator: ['read-channel'],
    },
  }
  const types = await api.listChannelTypes()
  if (types.channel_types[CHANNEL_TYPE])
    await api.updateChannelType(CHANNEL_TYPE, config)
  else await api.createChannelType({ name: CHANNEL_TYPE, ...config })
}

export const streamProvider: MessagingProvider = {
  async session(user) {
    const api = stream()
    // Fail closed if a channel type has not been provisioned securely.
    const config = await api.getChannelType(CHANNEL_TYPE)
    if (
      config.push_notifications ||
      config.grants?.channel_member?.some((g) => g !== 'read-channel') ||
      config.grants?.user?.length
    ) {
      throw new Error(
        'Stream channel configuration must be updated with messaging:configure',
      )
    }
    await api.upsertUser({ id: user.id, name: user.name, role: 'user' })
    await api
      .channel(CHANNEL_TYPE, channelId(user.id), {
        members: [user.id],
        created_by_id: user.id,
      })
      .create()
    const now = Math.floor(Date.now() / 1000)
    return {
      provider: 'stream',
      apiKey: process.env.STREAM_API_KEY!.trim(),
      userId: user.id,
      token: api.createToken(user.id, now + 3600, now),
      channelType: CHANNEL_TYPE,
      channelId: channelId(user.id),
    }
  },
  async publish(signal) {
    const api = stream()
    await api.upsertUser({ id: signal.recipientId, role: 'user' })
    const channel = api.channel(CHANNEL_TYPE, channelId(signal.recipientId), {
      members: [signal.recipientId],
      created_by_id: signal.recipientId,
    })
    await channel.create()
    // Per-user invalidations contain no message text, media URLs, or member lists.
    // Every data read goes through Logmaster's current authorization checks.
    const id = createHash('sha256')
      .update(`${signal.messageId}:${signal.recipientId}`)
      .digest('hex')
    try {
      await channel.sendMessage(
        {
          id,
          text: 'Message updated',
          user_id: signal.recipientId,
          logmaster: {
            version: 1,
            message_id: signal.messageId,
            thread_id: signal.threadId,
            response_card: signal.responseCard,
          },
        },
        { skip_push: true },
      )
    } catch (error) {
      // A retry after partial fan-out may encounter an already persisted signal.
      const existing = await api.getMessage(id).catch(() => null)
      if (existing?.message.logmaster?.message_id !== signal.messageId)
        throw error
    }
  },
  verifyWebhook(body, signature) {
    return stream().verifyWebhook(body, signature)
  },
}
