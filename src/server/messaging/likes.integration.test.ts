import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../generated/prisma/client'

const url = process.env.MESSAGE_LIKES_TEST_DATABASE_URL
const ids = Array.from({ length: 4 }, () => randomUUID())
const messageId = randomUUID()
let db: PrismaClient

describe.skipIf(!url)('message likes PostgreSQL persistence', () => {
  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    await db.user.createMany({
      data: ids.map((id) => ({
        id,
        name: 'Like test',
        email: `${id}@example.test`,
      })),
    })
    await db.chatMessage.create({
      data: {
        id: messageId,
        senderId: ids[0],
        threadId: `test:${messageId}`,
        text: 'Like test',
        references: [],
      },
    })
  })
  afterAll(async () => {
    await db.chatMessage.deleteMany({ where: { id: messageId } })
    await db.user.deleteMany({ where: { id: { in: ids } } })
    await db.$disconnect()
  })
  it('accumulates likes per user and sums counts across members', async () => {
    await db.chatMessageLike.upsert({
      where: {
        messageId_userId: { messageId, userId: ids[1] },
      },
      create: { messageId, userId: ids[1], count: 1 },
      update: { count: { increment: 1 } },
    })
    await db.chatMessageLike.upsert({
      where: {
        messageId_userId: { messageId, userId: ids[1] },
      },
      create: { messageId, userId: ids[1], count: 1 },
      update: { count: { increment: 1 } },
    })
    await db.chatMessageLike.upsert({
      where: {
        messageId_userId: { messageId, userId: ids[2] },
      },
      create: { messageId, userId: ids[2], count: 1 },
      update: { count: { increment: 1 } },
    })
    const rows = await db.chatMessageLike.findMany({ where: { messageId } })
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.userId === ids[1])?.count).toBe(2)
    expect(rows.reduce((total, row) => total + row.count, 0)).toBe(3)
    await db.user.delete({ where: { id: ids[2] } })
    expect(await db.chatMessageLike.count({ where: { messageId } })).toBe(1)
    await db.chatMessage.delete({ where: { id: messageId } })
    expect(await db.chatMessageLike.count({ where: { messageId } })).toBe(0)
  })
})
