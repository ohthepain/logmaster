import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { prisma } from '../db'
import {
  CARD_LANGUAGES,
  MAX_CARD_BYTES,
  normalizeCardExpression,
} from '../../domain/response-cards'
import { cardSummary, uploadResponseCard } from '../messaging/cards'

// Mounted after the platform-admin middleware in admin.ts.
export const adminResponseCardsRoutes = new Hono()
adminResponseCardsRoutes.onError((error, c) => {
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status)
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return c.json({ error: 'Invalid response card request' }, 400)
  console.error('[response-cards] admin request failed', {
    name: error.name,
    message: error.message,
  })
  return c.json(
    { error: 'Could not save response cards. Please try again.' },
    503,
  )
})
const expressionInput = z
  .object({
    language: z.enum(CARD_LANGUAGES),
    text: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((value) => !!normalizeCardExpression(value)),
  })
  .strict()
const uuid = z.string().uuid()

async function idsInGroup(expressionId: string) {
  const expression = await prisma.messagingExpression.findUnique({
    where: { id: expressionId },
  })
  if (!expression) return null
  const groupId = expression.groupId || expressionId
  const members = await prisma.messagingExpression.findMany({
    where: { groupId },
    select: { id: true },
  })
  return [...new Set(members.map((member) => member.id).concat(expressionId))]
}

adminResponseCardsRoutes.get('/', async (c) => {
  const language = z.enum(CARD_LANGUAGES).parse(c.req.query('language') ?? 'en')
  const [expressions, cards] = await Promise.all([
    prisma.messagingExpression.findMany({
      where: { language },
      orderBy: { text: 'asc' },
      include: {
        cards: {
          where: { card: { deletedAt: null } },
          include: { card: true },
        },
      },
    }),
    prisma.messagingCard.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  return c.json({
    expressions: expressions.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      language: e.language,
      text: e.text,
      cards: e.cards.map((link) => cardSummary(link.card)),
    })),
    cards: cards.map(cardSummary),
  })
})
adminResponseCardsRoutes.post('/expressions', async (c) => {
  const { language, text } = expressionInput.parse(await c.req.json())
  const normalized = normalizeCardExpression(text)
  const id = crypto.randomUUID()
  const expression = await prisma.messagingExpression.upsert({
    where: { language_normalized: { language, normalized } },
    create: { id, groupId: id, language, text, normalized },
    update: { text },
  })
  return c.json({ expression })
})
adminResponseCardsRoutes.post('/expressions/:id/aliases', async (c) => {
  const anchorId = uuid.parse(c.req.param('id'))
  const { text } = z
    .object({
      text: expressionInput.shape.text,
    })
    .strict()
    .parse(await c.req.json())
  const anchor = await prisma.messagingExpression.findUnique({
    where: { id: anchorId },
    include: { cards: { select: { cardId: true } } },
  })
  if (!anchor) throw new HTTPException(404, { message: 'Expression not found' })
  const normalized = normalizeCardExpression(text)
  const cardIds = anchor.cards.map((link) => link.cardId)
  const existing = await prisma.messagingExpression.findUnique({
    where: {
      language_normalized: { language: anchor.language, normalized },
    },
  })
  if (existing?.groupId === anchor.groupId) return c.json({ expression: existing })
  const expression = existing
    ? await prisma.messagingExpression.update({
        where: { id: existing.id },
        data: { groupId: anchor.groupId, text },
      })
    : await prisma.messagingExpression.create({
        data: {
          groupId: anchor.groupId,
          language: anchor.language,
          text,
          normalized,
        },
      })
  if (existing)
    await prisma.messagingCardLink.deleteMany({
      where: { expressionId: expression.id },
    })
  if (cardIds.length)
    await prisma.messagingCardLink.createMany({
      data: cardIds.map((cardId) => ({ expressionId: expression.id, cardId })),
      skipDuplicates: true,
    })
  return c.json({ expression }, existing ? 200 : 201)
})
adminResponseCardsRoutes.delete('/expressions/:id', async (c) => {
  await prisma.messagingExpression.deleteMany({
    where: { id: uuid.parse(c.req.param('id')) },
  })
  return c.json({ ok: true })
})
adminResponseCardsRoutes.post(
  '/expressions/:id/upload',
  // Only image uploads need this. Wrapping every request body fails for
  // empty deletes: Node cannot rebuild that Request.
  bodyLimit({ maxSize: MAX_CARD_BYTES + 64 * 1024 }),
  async (c) => {
    const expressionId = uuid.parse(c.req.param('id'))
    if (
      !(await prisma.messagingExpression.findUnique({
        where: { id: expressionId },
      }))
    )
      throw new HTTPException(404, { message: 'Expression not found' })
    const body = await c.req.parseBody()
    if (!(body.file instanceof File))
      throw new HTTPException(400, { message: 'Choose an image file.' })
    const card = await uploadResponseCard(body.file)
    const ids = (await idsInGroup(expressionId)) ?? [expressionId]
    await prisma.messagingCardLink.createMany({
      data: ids.map((id) => ({ expressionId: id, cardId: card.id })),
      skipDuplicates: true,
    })
    return c.json({ card: cardSummary(card) }, 201)
  },
)
adminResponseCardsRoutes.put('/expressions/:id/cards/:cardId', async (c) => {
  const expressionId = uuid.parse(c.req.param('id')),
    cardId = uuid.parse(c.req.param('cardId'))
  const [expression, card] = await Promise.all([
    prisma.messagingExpression.findUnique({ where: { id: expressionId } }),
    prisma.messagingCard.findFirst({ where: { id: cardId, deletedAt: null } }),
  ])
  if (!expression || !card)
    throw new HTTPException(404, { message: 'Card or expression not found' })
  const ids = (await idsInGroup(expressionId)) ?? [expressionId]
  await prisma.messagingCardLink.createMany({
    data: ids.map((id) => ({ expressionId: id, cardId })),
    skipDuplicates: true,
  })
  return c.json({ ok: true })
})
adminResponseCardsRoutes.delete('/expressions/:id/cards/:cardId', async (c) => {
  const expressionId = uuid.parse(c.req.param('id'))
  const ids = (await idsInGroup(expressionId)) ?? [expressionId]
  await prisma.messagingCardLink.deleteMany({
    where: {
      expressionId: { in: ids },
      cardId: uuid.parse(c.req.param('cardId')),
    },
  })
  return c.json({ ok: true })
})
adminResponseCardsRoutes.patch('/cards/:id', async (c) => {
  const data = z
    .object({
      title: z.string().trim().min(1).max(120).optional(),
      enabled: z.boolean().optional(),
    })
    .strict()
    .parse(await c.req.json())
  await prisma.messagingCard.updateMany({
    where: { id: uuid.parse(c.req.param('id')), deletedAt: null },
    data,
  })
  return c.json({ ok: true })
})
adminResponseCardsRoutes.delete('/cards/:id', async (c) => {
  const id = uuid.parse(c.req.param('id'))
  await prisma.$transaction([
    prisma.messagingCard.updateMany({
      where: { id },
      data: { deletedAt: new Date(), enabled: false },
    }),
    prisma.messagingCardLink.deleteMany({ where: { cardId: id } }),
  ])
  return c.json({ ok: true })
})
