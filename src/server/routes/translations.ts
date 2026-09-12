import { Hono } from 'hono'
import { prisma } from '../db'

const db = prisma as any

export const translationsRoutes = new Hono()

// Runtime translation fixes are public so signed-out screens can use them too.
translationsRoutes.get('/:language', async (c) => {
  const language = c.req.param('language').trim().toLowerCase()
  const rows = await db.translationOverride.findMany({
    where: { language },
    select: { key: true, value: true },
  })
  return c.json({
    language,
    translations: Object.fromEntries(
      rows.map((row: { key: string; value: string }) => [row.key, row.value]),
    ),
  })
})
