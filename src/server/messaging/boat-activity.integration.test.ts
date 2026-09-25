import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../../../generated/prisma/client'
import type { Prisma } from '../../../generated/prisma/client'

// Explicit opt-in. Every synthetic outbox row is marked delivered BEFORE commit,
// so a concurrently running worker cannot send test signals or notifications.
const url = process.env.BOAT_ACTIVITY_TEST_DATABASE_URL
const boatId = randomUUID(),
  userId = randomUUID(),
  memberId = randomUUID()
let db: PrismaClient
async function change<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async (tx) => {
    const result = await run(tx)
    await tx.chatMessage.updateMany({
      where: { threadId: `boat:${boatId}` },
      data: { publishedAt: new Date() },
    })
    return result
  })
}
const activity = (resourceId: string) =>
  db.boatActivity.findMany({
    where: { boatId, resourceId },
    orderBy: { createdAt: 'asc' },
  })

describe.skipIf(!url)('boat activity PostgreSQL capture', () => {
  beforeAll(async () => {
    if (!['localhost', '127.0.0.1'].includes(new URL(url!).hostname))
      throw new Error('Use a local test database')
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    await db.user.createMany({
      data: [userId, memberId].map((id) => ({
        id,
        name: 'Activity test',
        email: `${id}@example.test`,
      })),
    })
    await db.boat.create({
      data: { id: boatId, userId, name: 'Activity test boat' },
    })
  })
  afterAll(async () => {
    if (!db) return
    await db.boat.deleteMany({ where: { id: boatId } })
    await db.user.deleteMany({ where: { id: { in: [userId, memberId] } } })
    await db.$disconnect()
  })
  it('captures media and versioned documents once, retaining removal labels', async () => {
    const photo = await change((tx) =>
      tx.boatPhoto.create({
        data: { boatId, s3Key: 'test/nonexistent', caption: 'Sunset' },
      }),
    )
    await change((tx) =>
      tx.boatPhoto.update({
        where: { id: photo.id },
        data: { sortOrder: 4, isDefault: true },
      }),
    )
    expect((await activity(photo.id)).map((a) => a.kind)).toEqual([
      'MEDIA_ADDED',
    ])
    await change((tx) => tx.boatPhoto.delete({ where: { id: photo.id } }))
    expect((await activity(photo.id)).map((a) => [a.kind, a.label])).toEqual([
      ['MEDIA_ADDED', 'Sunset'],
      ['MEDIA_REMOVED', 'Sunset'],
    ])
    const category = await db.boatDocumentCategory.create({
      data: { boatId, name: 'Test' },
    })
    const document = await change((tx) =>
      tx.boatDocument.create({
        data: {
          boatId,
          categoryId: category.id,
          title: 'Manual',
          versions: {
            create: {
              versionNumber: 1,
              kind: 'upload',
              mimeType: 'application/pdf',
              s3Key: 'test/manual',
            },
          },
        },
        include: { versions: true },
      }),
    )
    expect(await activity(document.id)).toHaveLength(1)
    expect((await activity(document.id))[0].versionId).toBe(
      document.versions[0].id,
    )
    const version = await change(async (tx) => {
      const value = await tx.boatDocumentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 2,
          kind: 'upload',
          s3Key: 'test/manual2',
        },
      })
      await tx.boatDocument.update({
        where: { id: document.id },
        data: { title: 'New manual' },
      })
      return value
    })
    const events = await activity(document.id)
    expect(events.map((a) => a.kind)).toEqual([
      'DOCUMENT_ADDED',
      'DOCUMENT_UPDATED',
    ])
    expect(events[1]).toMatchObject({
      label: 'New manual',
      versionId: version.id,
    })
    await change((tx) =>
      tx.boatDocumentVersion.update({
        where: { id: version.id },
        data: { previewS3Key: 'test/preview' },
      }),
    )
    expect(await activity(document.id)).toHaveLength(2)
    await change((tx) => tx.boatDocument.delete({ where: { id: document.id } }))
    expect((await activity(document.id)).at(-1)).toMatchObject({
      kind: 'DOCUMENT_REMOVED',
      label: 'New manual',
    })
    const assetPhoto = await change((tx) =>
      tx.boatDocument.create({
        data: {
          boatId,
          categoryId: category.id,
          title: 'Engine photo',
          purpose: 'photo',
          versions: {
            create: {
              versionNumber: 1,
              kind: 'upload',
              mimeType: 'image/jpeg',
              s3Key: 'test/photo',
            },
          },
        },
      }),
    )
    expect((await activity(assetPhoto.id)).map((a) => a.kind)).toEqual([
      'MEDIA_ADDED',
    ])
  })
  it('captures equipment and explicit network connections, ignoring system-network upserts', async () => {
    const a = await change((tx) =>
      tx.boatAsset.create({
        data: { boatId, name: 'Engine', ownership: 'BOAT' },
      }),
    )
    const b = await change((tx) =>
      tx.boatAsset.create({
        data: { boatId, name: 'Display', ownership: 'BOAT' },
      }),
    )
    const n = await change((tx) =>
      tx.boatAsset.create({
        data: {
          boatId,
          name: 'NMEA',
          ownership: 'BOAT',
          kind: 'system_network',
          networkKey: 'nmea_2000',
        },
      }),
    )
    await change((tx) =>
      tx.boatAsset.update({ where: { id: n.id }, data: { name: 'NMEA 2000' } }),
    )
    expect(await activity(n.id)).toHaveLength(0)
    await change((tx) =>
      tx.boatAsset.update({ where: { id: a.id }, data: { brand: 'Volvo' } }),
    )
    await change((tx) =>
      tx.boatAsset.update({
        where: { id: a.id },
        data: { brand: 'Volvo', sortOrder: 3 },
      }),
    )
    expect((await activity(a.id)).map((e) => e.kind)).toEqual([
      'ASSET_ADDED',
      'ASSET_UPDATED',
    ])
    for (const [endpoint, prefix] of [
      [b.id, 'ASSET'],
      [n.id, 'NETWORK'],
    ] as const) {
      const connection = await change((tx) =>
        tx.assetConnection.create({
          data: {
            boatId,
            fromAssetId: a.id,
            toAssetId: endpoint,
            reason: 'Test',
            confirmedBy: userId,
          },
        }),
      )
      await change((tx) =>
        tx.assetConnection.delete({ where: { id: connection.id } }),
      )
      expect((await activity(connection.id)).map((e) => e.kind)).toEqual([
        `${prefix}_CONNECTED`,
        `${prefix}_DISCONNECTED`,
      ])
      expect((await activity(connection.id))[0].label).toBe('Engine')
    }
    const cascadeConnection = await change((tx) =>
      tx.assetConnection.create({
        data: {
          boatId,
          fromAssetId: a.id,
          toAssetId: n.id,
          reason: 'Test cascade',
          confirmedBy: userId,
        },
      }),
    )
    await change((tx) => tx.boatAsset.delete({ where: { id: a.id } }))
    expect(
      (await activity(cascadeConnection.id)).map((event) => event.kind),
    ).toEqual(['NETWORK_CONNECTED', 'NETWORK_DISCONNECTED'])

    expect((await activity(a.id)).at(-1)?.kind).toBe('ASSET_REMOVED')
  })
  it('captures purchases, contacts, members and share ownership changes', async () => {
    const purchase = await change((tx) =>
      tx.boatPurchase.create({ data: { boatId, supplierName: 'Chandlery' } }),
    )
    await change((tx) => tx.boatPurchase.delete({ where: { id: purchase.id } }))
    expect((await activity(purchase.id)).map((a) => a.kind)).toEqual([
      'PURCHASE_ADDED',
      'PURCHASE_REMOVED',
    ])
    const contact = await change((tx) =>
      tx.boatContact.create({ data: { boatId, displayName: 'Mechanic' } }),
    )
    await change((tx) =>
      tx.boatContact.update({
        where: { id: contact.id },
        data: { phone: 'private-number' },
      }),
    )
    await change((tx) => tx.boatContact.delete({ where: { id: contact.id } }))
    expect((await activity(contact.id)).map((a) => a.kind)).toEqual([
      'CONTACT_ADDED',
      'CONTACT_UPDATED',
      'CONTACT_REMOVED',
    ])
    expect(JSON.stringify(await activity(contact.id))).not.toContain(
      'private-number',
    )
    const member = await change((tx) =>
      tx.boatMember.create({
        data: { boatId, userId: memberId, role: 'MEMBER' },
      }),
    )
    await change((tx) =>
      tx.boatMember.update({
        where: { id: member.id },
        data: { role: 'ADMIN' },
      }),
    )
    await change((tx) => tx.boatMember.delete({ where: { id: member.id } }))
    expect((await activity(member.id)).map((a) => a.kind)).toEqual([
      'MEMBER_ADDED',
      'MEMBER_UPDATED',
      'MEMBER_REMOVED',
    ])
    expect(
      (await activity(member.id)).map((a) => ({
        name: a.label,
        email: a.memberEmail,
        role: a.memberRole,
        previous: a.previousMemberRole,
      })),
    ).toEqual([
      {
        name: 'Activity test',
        email: `${memberId}@example.test`,
        role: 'MEMBER',
        previous: null,
      },
      {
        name: 'Activity test',
        email: `${memberId}@example.test`,
        role: 'ADMIN',
        previous: 'MEMBER',
      },
      {
        name: 'Activity test',
        email: `${memberId}@example.test`,
        role: 'ADMIN',
        previous: null,
      },
    ])
    const share = await change((tx) =>
      tx.boatShare.create({ data: { boatId, sequence: 1 } }),
    )
    expect((await activity(share.id))[0].label).toBe('#2')
    const owner = await change((tx) =>
      tx.boatShareOwner.create({
        data: { shareId: share.id, userId: memberId },
      }),
    )
    await change((tx) => tx.boatShareOwner.delete({ where: { id: owner.id } }))
    await change((tx) =>
      tx.boatShare.update({
        where: { id: share.id },
        data: { label: 'Quarter' },
      }),
    )
    await change(async (tx) => {
      await tx.boatShare.update({
        where: { id: share.id },
        data: { sequence: -1 },
      })
      await tx.boatShare.update({
        where: { id: share.id },
        data: { sequence: 2 },
      })
    })
    await change((tx) => tx.boatShare.delete({ where: { id: share.id } }))
    expect((await activity(share.id)).map((a) => a.kind)).toEqual([
      'SHARE_ADDED',
      'SHARE_UPDATED',
      'SHARE_UPDATED',
      'SHARE_UPDATED',
      'SHARE_REMOVED',
    ])
  })
  it('coalesces member role changes and ignores no-op writes', async () => {
    const member = await change(async (tx) => {
      const row = await tx.boatMember.create({
        data: { boatId, userId: memberId, role: 'MEMBER' },
      })
      await tx.boatMember.update({
        where: { id: row.id },
        data: { role: 'VIEWER' },
      })
      return row
    })
    expect(await activity(member.id)).toHaveLength(1)
    expect((await activity(member.id))[0]).toMatchObject({
      kind: 'MEMBER_ADDED',
      memberRole: 'VIEWER',
      previousMemberRole: null,
    })
    await change(async (tx) => {
      await tx.boatMember.update({
        where: { id: member.id },
        data: { role: 'MEMBER' },
      })
      await tx.boatMember.update({
        where: { id: member.id },
        data: { role: 'ADMIN' },
      })
    })
    expect((await activity(member.id)).at(-1)).toMatchObject({
      kind: 'MEMBER_UPDATED',
      memberRole: 'ADMIN',
      previousMemberRole: 'VIEWER',
    })
    await change((tx) =>
      tx.boatMember.update({
        where: { id: member.id },
        data: { role: 'ADMIN' },
      }),
    )
    expect(await activity(member.id)).toHaveLength(2)
    await db.user.update({
      where: { id: memberId },
      data: { name: 'New name', email: `${memberId}-new@example.test` },
    })
    expect((await activity(member.id))[0]).toMatchObject({
      label: 'Activity test',
      memberEmail: `${memberId}@example.test`,
    })
    await change((tx) => tx.boatMember.delete({ where: { id: member.id } }))
  })
  it('rolls back events with source changes and deletes history with the boat', async () => {
    const id = randomUUID()
    await expect(
      change(async (tx) => {
        await tx.boatPhoto.create({
          data: { id, boatId, s3Key: 'test/rollback' },
        })
        throw new Error('Rollback test')
      }),
    ).rejects.toThrow('Rollback test')
    expect(await activity(id)).toHaveLength(0)
    const messages = await db.chatMessage.findMany({
      where: { threadId: `boat:${boatId}` },
    })
    expect(messages.length).toBeGreaterThan(20)
    expect(
      messages.every(
        (m) =>
          m.boatActivityId && m.publishedAt && m.senderId === 'system:boat',
      ),
    ).toBe(true)
    await db.boat.delete({ where: { id: boatId } })
    expect(await db.boatActivity.count({ where: { boatId } })).toBe(0)
    expect(
      await db.chatMessage.count({ where: { threadId: `boat:${boatId}` } }),
    ).toBe(0)
  })
})
