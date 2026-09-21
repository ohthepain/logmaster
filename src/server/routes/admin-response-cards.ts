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
adminResponseCardsRoutes.use(
  '*',
  bodyLimit({ maxSize: MAX_CARD_BYTES + 64 * 1024 }),
)
adminResponseCardsRoutes.onError((error, c) => {
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status)
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return c.json({ error: 'Invalid response card request' }, 400)
  console.error('[response-cards] admin request failed', { name: error.name })
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
  const expression = await prisma.messagingExpression.upsert({
    where: { language_normalized: { language, normalized } },
    create: { language, text, normalized },
    update: { text },
  })
  return c.json({ expression })
})
adminResponseCardsRoutes.delete('/expressions/:id', async (c) => {
  await prisma.messagingExpression.deleteMany({
    where: { id: uuid.parse(c.req.param('id')) },
  })
  return c.json({ ok: true })
})
adminResponseCardsRoutes.post('/expressions/:id/upload', async (c) => {
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
  await prisma.messagingCardLink.upsert({
    where: { expressionId_cardId: { expressionId, cardId: card.id } },
    create: { expressionId, cardId: card.id },
    update: {},
  })
  return c.json({ card: cardSummary(card) }, 201)
})
adminResponseCardsRoutes.put('/expressions/:id/cards/:cardId', async (c) => {
  const expressionId = uuid.parse(c.req.param('id')),
    cardId = uuid.parse(c.req.param('cardId'))
  const [expression, card] = await Promise.all([
    prisma.messagingExpression.findUnique({ where: { id: expressionId } }),
    prisma.messagingCard.findFirst({ where: { id: cardId, deletedAt: null } }),
  ])
  if (!expression || !card)
    throw new HTTPException(404, { message: 'Card or expression not found' })
  await prisma.messagingCardLink.upsert({
    where: { expressionId_cardId: { expressionId, cardId } },
    create: { expressionId, cardId },
    update: {},
  })
  return c.json({ ok: true })
})
adminResponseCardsRoutes.delete('/expressions/:id/cards/:cardId', async (c) => {
  await prisma.messagingCardLink.deleteMany({
    where: {
      expressionId: uuid.parse(c.req.param('id')),
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
