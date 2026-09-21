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
  it('counts concurrent retries once per user and removes only the selected user’s like', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        db.chatMessageLike.createMany({
          data: [{ messageId, userId: ids[1 + (i % 3)] }],
          skipDuplicates: true,
        }),
      ),
    )
    expect(await db.chatMessageLike.count({ where: { messageId } })).toBe(3)
    await db.chatMessageLike.deleteMany({
      where: { messageId, userId: ids[1] },
    })
    await db.chatMessageLike.deleteMany({
      where: { messageId, userId: ids[1] },
    })
    expect(await db.chatMessageLike.count({ where: { messageId } })).toBe(2)
    const view = await db.chatMessage.findUniqueOrThrow({
      where: { id: messageId },
      select: {
        _count: { select: { likes: true } },
        likes: { where: { userId: ids[2] } },
      },
    })
    expect(view._count.likes).toBe(2)
    expect(view.likes).toHaveLength(1)
    await db.user.delete({ where: { id: ids[2] } })
    expect(await db.chatMessageLike.count({ where: { messageId } })).toBe(1)
    await db.chatMessage.delete({ where: { id: messageId } })
    expect(await db.chatMessageLike.count({ where: { messageId } })).toBe(0)
  })
})
