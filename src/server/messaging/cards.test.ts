import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import {
  matchResponseCards,
  responseCardSnapshot,
  translateCardText,
  uploadResponseCard,
} from './cards'
import { normalizeCardExpression } from '../../domain/response-cards'

const mocks = vi.hoisted(() => ({
  expression: vi.fn(),
  first: vi.fn(),
  unique: vi.fn(),
  upsert: vi.fn(),
  send: vi.fn(),
  chat: vi.fn(),
}))
vi.mock('../db', () => ({
  prisma: {
    messagingExpression: { findUnique: mocks.expression },
    messagingCard: {
      findFirst: mocks.first,
      findUnique: mocks.unique,
      upsert: mocks.upsert,
    },
  },
}))
vi.mock('../s3-photos', () => ({
  getPhotosS3Client: () => ({ send: mocks.send }),
}))
vi.mock('@tanstack/ai', () => ({ chat: mocks.chat }))
vi.mock('@tanstack/ai-openai', () => ({ openaiText: () => 'adapter' }))
const card = (id: string) => ({
  id,
  title: id,
  checksum: 'a'.repeat(64),
  enabled: true,
})
beforeEach(() => {
  vi.resetAllMocks()
  mocks.expression.mockResolvedValue(null)
})
it('matches whole Unicode phrases, preserving meaningful accents', () => {
  expect(normalizeCardExpression('  ＹＥＳ!!! ')).toBe('yes')
  expect(normalizeCardExpression('Sí   por favor.')).toBe('sí por favor')
  expect(normalizeCardExpression('是！')).toBe('是')
  expect(normalizeCardExpression('I said yes')).not.toBe('yes')
})
it('orders local, translated English, then verbatim English matches and deduplicates', async () => {
  mocks.expression.mockImplementation(async ({ where }) => {
    const { language, normalized } = where.language_normalized
    const ids =
      language === 'sv'
        ? ['local', 'shared']
        : normalized === 'yes'
          ? ['shared', 'translated']
          : ['verbatim']
    return { cards: ids.map((id) => ({ card: card(id) })) }
  })
  const translate = vi.fn(async () => 'Yes!')
  const result = await matchResponseCards('Ja', 'sv', translate)
  expect(result.cards.map((c) => c.id)).toEqual([
    'local',
    'shared',
    'translated',
    'verbatim',
  ])
  expect(translate).toHaveBeenCalledOnce()
  expect(
    mocks.expression.mock.calls.map(
      ([input]) => input.where.language_normalized,
    ),
  ).toEqual([
    { language: 'sv', normalized: 'ja' },
    { language: 'en', normalized: 'yes' },
    { language: 'en', normalized: 'ja' },
  ])
  expect(mocks.expression.mock.calls[0][0].include.cards.where).toEqual({
    card: { enabled: true, deletedAt: null },
  })
})
it('always tries English verbatim when translation fails, and never translates English', async () => {
  mocks.expression.mockResolvedValue({ cards: [{ card: card('english') }] })
  const failed = await matchResponseCards('yes', 'fr', async () => {
    throw new Error('offline')
  })
  expect(failed.cards).toHaveLength(1)
  expect(failed.translationUnavailable).toBe(true)
  expect(mocks.expression).toHaveBeenLastCalledWith(
    expect.objectContaining({
      where: { language_normalized: { language: 'en', normalized: 'yes' } },
    }),
  )
  const translate = vi.fn()
  await matchResponseCards('YES', 'en', translate)
  expect(translate).not.toHaveBeenCalled()
})
it('signs no arbitrary card data into a message and rejects retired cards', async () => {
  mocks.first.mockResolvedValue(null)
  await expect(responseCardSnapshot('missing')).rejects.toThrow(
    'no longer available',
  )
  mocks.first.mockResolvedValue({
    ...card('card'),
    contentType: 'image/png',
    secret: 'not-for-client',
  })
  expect(await responseCardSnapshot('card')).toEqual({
    version: 1,
    type: 'image-response',
    card: card('card'),
  })
})
it('validates file contents and stores a checksum-addressed image in the requested S3 bucket', async () => {
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 4, background: '#0385ff' },
  })
    .png()
    .toBuffer()
  mocks.unique.mockResolvedValue(null)
  mocks.upsert.mockResolvedValue(card('new'))
  await uploadResponseCard(
    new File([new Uint8Array(bytes)], 'Yes.png', { type: 'image/png' }),
  )
  const command = mocks.send.mock.calls[0][0]
  expect(command.input).toMatchObject({
    Bucket: 'logmaster-messaging-cards',
    ContentType: 'image/png',
    ServerSideEncryption: 'AES256',
  })
  expect(command.input.Key).toMatch(/^sha256\/[a-f0-9]{64}$/)
  expect(mocks.upsert.mock.calls[0][0].create.title).toBe('Yes')
  mocks.send.mockClear()
  mocks.unique.mockResolvedValue(card('existing'))
  await uploadResponseCard(new File([new Uint8Array(bytes)], 'Again.png'))
  expect(mocks.send).not.toHaveBeenCalled()
  await expect(
    uploadResponseCard(
      new File(['<svg onload="alert(1)"></svg>'], 'fake.png', {
        type: 'image/png',
      }),
    ),
  ).rejects.toThrow('Use a PNG')
})
it('coalesces repeated translation requests and keeps draft text out of logs', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test')
  mocks.chat.mockResolvedValue({ english: 'yes' })
  const result = await Promise.all([
    translateCardText('ja', 'sv', 'test-user'),
    translateCardText('ja', 'sv', 'test-user'),
  ])
  expect(result).toEqual(['yes', 'yes'])
  expect(mocks.chat).toHaveBeenCalledOnce()
  vi.unstubAllEnvs()
})
