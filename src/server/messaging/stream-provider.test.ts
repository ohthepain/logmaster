import { beforeEach, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { StreamChat } from 'stream-chat'
import type * as StreamSDK from 'stream-chat'
import { configureStream, streamProvider } from './stream-provider'

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  create: vi.fn(),
  upsert: vi.fn(),
  channel: vi.fn(),
  token: vi.fn(),
  config: vi.fn(),
  types: vi.fn(),
  createType: vi.fn(),
  updateType: vi.fn(),
  getMessage: vi.fn(),
}))
vi.mock('stream-chat', async (importOriginal) => {
  const actual = await importOriginal<typeof StreamSDK>()
  return {
    StreamChat: vi.fn(function () {
      return {
        upsertUser: mocks.upsert,
        channel: mocks.channel,
        createToken: mocks.token,
        getChannelType: mocks.config,
        listChannelTypes: mocks.types,
        createChannelType: mocks.createType,
        updateChannelType: mocks.updateType,
        getMessage: mocks.getMessage,
        verifyWebhook: new actual.StreamChat(
          'test-api-key',
          'test-secret',
        ).verifyWebhook.bind(
          new actual.StreamChat('test-api-key', 'test-secret'),
        ),
      }
    }),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('STREAM_API_KEY', 'test-api-key')
  vi.stubEnv('STREAM_API_SECRET', 'test-secret')
  mocks.channel.mockReturnValue({
    create: mocks.create,
    sendMessage: mocks.send,
  })
  mocks.send.mockResolvedValue({})
  mocks.getMessage.mockResolvedValue(null)
  mocks.config.mockResolvedValue({
    push_notifications: false,
    grants: { user: [], channel_member: ['read-channel'] },
  })
  mocks.token.mockReturnValue('signed-user-token')
  mocks.types.mockResolvedValue({ channel_types: {} })
})
it('provisions a read-only channel type with Stream push disabled', async () => {
  await configureStream()
  expect(mocks.createType.mock.calls[0][0]).toMatchObject({
    name: 'logmaster_events',
    push_notifications: false,
    grants: { user: [], channel_member: ['read-channel'] },
  })
})
it('upserts our identity, signs an expiring token server-side and returns no secret', async () => {
  const session = await streamProvider.session({
    id: 'local-user',
    name: 'Alice',
  })
  expect(mocks.upsert).toHaveBeenCalledWith({
    id: 'local-user',
    name: 'Alice',
    role: 'user',
  })
  expect(mocks.token.mock.calls[0][1] - mocks.token.mock.calls[0][2]).toBe(3600)
  expect(session).toMatchObject({
    userId: 'local-user',
    token: 'signed-user-token',
  })
  expect(JSON.stringify(session)).not.toContain('test-secret')
  expect(StreamChat).toBeDefined()
})
it('fails closed if Stream push or client sending has been re-enabled', async () => {
  mocks.config.mockResolvedValueOnce({ push_notifications: true })
  await expect(
    streamProvider.session({ id: 'user', name: 'User' }),
  ).rejects.toThrow('configuration')
  mocks.config.mockResolvedValueOnce({
    grants: { channel_member: ['read-channel', 'create-message'] },
  })
  await expect(
    streamProvider.session({ id: 'user', name: 'User' }),
  ).rejects.toThrow('configuration')
  expect(mocks.token).not.toHaveBeenCalled()
})
it('publishes only a custom invalidation envelope and explicitly skips provider push', async () => {
  await streamProvider.publish({
    messageId: 'message',
    threadId: 'boat:boat',
    senderId: 'sender',
    recipientId: 'recipient',
    responseCard: null,
  })
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    logmaster: { version: 1, message_id: 'message', thread_id: 'boat:boat' },
  })
  expect(mocks.send.mock.calls[0][1]).toEqual({ skip_push: true })
})
it('tolerates a retry of a previously published signal without hiding real failures', async () => {
  const signal = {
    messageId: 'message',
    threadId: 'boat:boat',
    senderId: 'sender',
    recipientId: 'recipient',
    responseCard: null,
  }
  mocks.send.mockRejectedValue(new Error('duplicate or network'))
  mocks.getMessage.mockResolvedValueOnce({
    message: { logmaster: { message_id: 'message' } },
  })
  await expect(streamProvider.publish(signal)).resolves.toBeUndefined()
  await expect(streamProvider.publish(signal)).rejects.toThrow(
    'duplicate or network',
  )
})
it('uses the SDK to verify real HMAC signatures over raw bytes', () => {
  const body = '{"type":"message.new"}'
  const signature = createHmac('sha256', 'test-secret')
    .update(body)
    .digest('hex')
  expect(streamProvider.verifyWebhook(body, signature)).toBe(true)
  expect(streamProvider.verifyWebhook(body + ' ', signature)).toBe(false)
})
