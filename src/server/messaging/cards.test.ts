import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import {
  matchResponseCards,
  responseCardSnapshot,
  uploadResponseCard,
} from './cards'
import { normalizeCardExpression } from '../../domain/response-cards'

const mocks = vi.hoisted(() => ({
  expression: vi.fn(),
  first: vi.fn(),
  unique: vi.fn(),
  upsert: vi.fn(),
  send: vi.fn(),
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
it('matches exact phrases except case and whitespace', () => {
  expect(normalizeCardExpression('  OK  ')).toBe('ok')
  expect(normalizeCardExpression('Sí   por favor.')).toBe('sí por favor.')
  expect(normalizeCardExpression('YES!!!')).toBe('yes!!!')
  expect(normalizeCardExpression('ＹＥＳ')).not.toBe('yes')
  expect(normalizeCardExpression('是！')).not.toBe('是')
})
it('orders exact local and English matches, deduplicating cards', async () => {
  mocks.expression.mockImplementation(async ({ where }) => ({
    cards: (where.language_normalized.language === 'sv'
      ? ['local', 'shared']
      : ['shared', 'english']
    ).map((id) => ({ card: card(id) })),
  }))
  const result = await matchResponseCards(' JA ', 'sv')
  expect(result.cards.map((c) => c.id)).toEqual(['local', 'shared', 'english'])
  expect(
    mocks.expression.mock.calls.map(
      ([input]) => input.where.language_normalized,
    ),
  ).toEqual([
    { language: 'sv', normalized: 'ja' },
    { language: 'en', normalized: 'ja' },
  ])
  expect(mocks.expression.mock.calls[0][0].include.cards.where).toEqual({
    card: { enabled: true, deletedAt: null },
  })
})
it('does not autocomplete, strip punctuation or translate a near match', async () => {
  mocks.expression.mockImplementation(async ({ where }) =>
    where.language_normalized.normalized === 'ok'
      ? { cards: [{ card: card('ok') }] }
      : null,
  )
  expect((await matchResponseCards(' OK ', 'sv')).cards).toHaveLength(1)
  for (const text of ['okx', 'o', 'ok!', 'okay'])
    expect((await matchResponseCards(text, 'sv')).cards).toHaveLength(0)
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
