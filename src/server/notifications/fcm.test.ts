import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { sendFcmMessage } from './fcm'

const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  construct: vi.fn(),
  log: vi.fn(),
}))
vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    constructor(options: unknown) {
      mocks.construct(options)
    }
    getAccessToken = mocks.token
  },
}))
vi.mock('../lib/server-log', () => ({ logServerEvent: mocks.log }))

const args = {
  token: 'device-token',
  title: 'Maintenance',
  body: 'Service due',
  linkUrl: 'https://logmaster.live/jobs/1',
  notificationId: 'notice-1',
}
let send: typeof sendFcmMessage
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('FCM_PROJECT_ID', 'test-project')
  vi.stubEnv('FCM_SERVICE_ACCOUNT_JSON', '')
  mocks.token.mockResolvedValue('short-lived-token')
  fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response('{"name":"projects/test-project/messages/1"}'),
    )
  vi.stubGlobal('fetch', fetchMock)
  send = (await import('./fcm')).sendFcmMessage
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('FCM HTTP v1', () => {
  it('uses scoped server-side ADC and sends notification and string data', async () => {
    expect(await send(args)).toBe('sent')
    expect(mocks.construct).toHaveBeenCalledWith({
      credentials: undefined,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    })
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://fcm.googleapis.com/v1/projects/test-project/messages:send',
    )
    expect(request.headers.Authorization).toBe('Bearer short-lived-token')
    expect(JSON.parse(request.body)).toEqual({
      message: {
        token: args.token,
        notification: { title: args.title, body: args.body },
        data: { linkUrl: args.linkUrl, notificationId: args.notificationId },
      },
    })
    await send({ ...args, linkUrl: null })
    expect(mocks.construct).toHaveBeenCalledTimes(1)
    expect(mocks.token).toHaveBeenCalledTimes(2)
    expect(
      JSON.parse(fetchMock.mock.calls[1][1].body).message.data.linkUrl,
    ).toBe('')
  })

  it('supports service-account credentials injected by the server', async () => {
    const credentials = {
      type: 'service_account',
      client_email: 'sender@example.test',
      private_key: 'test-only',
    }
    vi.stubEnv('FCM_SERVICE_ACCOUNT_JSON', JSON.stringify(credentials))
    expect(await send(args)).toBe('sent')
    expect(mocks.construct.mock.calls[0][0].credentials).toEqual(credentials)
  })

  it('skips an unconfigured project without requesting credentials', async () => {
    vi.stubEnv('FCM_PROJECT_ID', ' ')
    expect(await send(args)).toBe('skipped')
    expect(mocks.token).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    'not-json',
    '{"type":"authorized_user"}',
    'null',
  ])('fails safely on invalid credential configuration %s', async (raw) => {
    vi.stubEnv('FCM_SERVICE_ACCOUNT_JSON', raw)
    expect(await send(args)).toBe('failed')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'fcm_auth_failed' }),
    )
  })

  it('does not log credentials from authentication errors', async () => {
    mocks.token.mockRejectedValue(
      new Error('private-key-secret access-token-secret'),
    )
    expect(await send(args)).toBe('failed')
    expect(JSON.stringify(mocks.log.mock.calls)).not.toMatch(
      /private-key-secret|access-token-secret/,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('only invalidates a confirmed unregistered token', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            details: [
              {
                '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
                errorCode: 'UNREGISTERED',
              },
            ],
          },
        }),
        { status: 404 },
      ),
    )
    expect(await send(args)).toBe('invalid-token')
  })

  it.each([
    400, 401, 403, 404, 429, 500, 503,
  ])('preserves tokens for HTTP %s', async (status) => {
    fetchMock.mockResolvedValue(
      new Response('{"error":{"status":"FAILED"}}', { status }),
    )
    expect(await send(args)).toBe('failed')
  })

  it.each([
    'INVALID_ARGUMENT',
    'SENDER_ID_MISMATCH',
  ])('preserves tokens for %s', async (errorCode) => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            details: [
              {
                '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
                errorCode,
              },
            ],
          },
        }),
        { status: 400 },
      ),
    )
    expect(await send(args)).toBe('failed')
  })

  it('handles non-JSON errors and network failures', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Unavailable', { status: 503 }),
    )
    expect(await send(args)).toBe('failed')
    fetchMock.mockRejectedValueOnce(
      new Error('network failed with sensitive request details'),
    )
    expect(await send(args)).toBe('failed')
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain('sensitive')
  })
})
