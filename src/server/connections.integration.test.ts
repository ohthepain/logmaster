import { afterAll, describe, expect, it, vi } from 'vitest'

const enabled =
  process.env.CONNECTIONS_INTEGRATION === '1' &&
  process.env.DATABASE_URL ===
    'postgresql://paulwilkinson@127.0.0.1:55441/postgres'
vi.mock('./session', () => ({
  getSessionUserId: async (headers: Headers) => headers.get('x-test-user'),
}))
vi.mock('./email/ses', () => ({
  sendConnectionInviteEmail: vi.fn(),
  sendMemberInviteEmail: vi.fn(),
}))
vi.mock('./notifications/route-hooks', () => ({
  fireOrgMembersNotification: vi.fn(),
}))

describe.skipIf(!enabled)(
  'connections and participation with PostgreSQL',
  async () => {
    if (!enabled) {
      it.skip('requires disposable database', () => {})
      return
    }
    const { prisma } = await import('./db')
    const { acceptConnection, canStartDirectChat } = await import(
      './connections'
    )
    const {
      directThreadId,
      startDirectChat,
      changeDirectParticipation,
      requireDirectSend,
    } = await import('./messaging/direct-conversations')
    const { requireThread } = await import('./messaging/threads')
    const { canAccess } = await import('./permissions')
    const { syncTripParticipants } = await import('./trip-participants')
    const { acceptMemberInvite } = await import('./member-invites')
    const { connectionsRoutes } = await import('./routes/connections')
    const { hasPendingInviteForEmail } = await import('./invite-signup')
    function request(path: string, userId?: string, body?: unknown) {
      return connectionsRoutes.request(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-test-user': userId } : {}),
        },
        body: JSON.stringify(body ?? {}),
      })
    }
    afterAll(async () => {
      await prisma.$disconnect()
    })
    async function user() {
      const id = crypto.randomUUID()
      return prisma.user.create({
        data: { id, name: id, email: `${id}@test.invalid` },
      })
    }
    async function connectedPair() {
      const a = await user(),
        b = await user()
      await prisma.$transaction((tx) => acceptConnection(tx, a.id, b.id))
      return { a, b }
    }
    async function message(id: string, senderId: string) {
      return prisma.$transaction(async (tx) => {
        await requireDirectSend(tx, id, senderId)
        return tx.chatMessage.create({
          data: {
            id: crypto.randomUUID(),
            threadId: id,
            senderId,
            text: 'Durable history',
            references: [],
          },
        })
      })
    }
    it('backfills symmetric connections, existing private history and completed-trip participants', async () => {
      expect(
        await prisma.userConnection.findMany({
          where: { userLowId: 'migration-a' },
        }),
      ).toMatchObject([{ userHighId: 'migration-b', status: 'ACCEPTED' }])
      const id = directThreadId('migration-a', 'migration-b')
      expect((await requireThread('migration-b', id)).canSend).toBe(true)
      expect(
        await prisma.chatMessage.findUnique({
          where: { id: 'migration-message' },
        }),
      ).toMatchObject({ threadId: id, text: 'Keep this history' })
      expect(
        await canAccess('migration-b', 'view', {
          type: 'trip',
          id: 'migration-trip',
        }),
      ).toBe(true)
      await prisma.crewMember.deleteMany({ where: { id: 'migration-crew' } })
      expect(
        await canAccess('migration-b', 'view', {
          type: 'trip',
          id: 'migration-trip',
        }),
      ).toBe(true)
      expect(
        (await requireThread('migration-b', 'trip:migration-trip')).memberIds,
      ).toContain('migration-b')
    })
    it('allows co-members to chat without a connection and retains the conversation after departure', async () => {
      const a = await user(),
        b = await user()
      const boat = await prisma.boat.create({
        data: {
          name: 'Shared boat',
          userId: a.id,
          members: { create: { userId: b.id, role: 'MEMBER' } },
        },
      })
      expect(await canStartDirectChat(a.id, b.id)).toBe(true)
      const chat = await startDirectChat(a.id, b.id)
      const sent = await message(chat.id, a.id)
      await prisma.boatMember.deleteMany({
        where: { boatId: boat.id, userId: b.id },
      })
      expect(await canStartDirectChat(a.id, b.id)).toBe(false)
      expect((await requireThread(b.id, chat.id)).canSend).toBe(true)
      await expect(requireThread(b.id, `boat:${boat.id}`)).rejects.toThrow(
        'Chat not found',
      )
      expect(
        await prisma.chatMessage.findUnique({ where: { id: sent.id } }),
      ).not.toBeNull()
      await message(chat.id, b.id)
      expect(
        await prisma.userConnection.count({
          where: { OR: [{ userLowId: a.id }, { userHighId: a.id }] },
        }),
      ).toBe(0)
    })
    it('leaving a private chat preserves history and requires the departing user to accept an invitation', async () => {
      const { a, b } = await connectedPair()
      const chat = await startDirectChat(a.id, b.id)
      const sent = await message(chat.id, a.id)
      await changeDirectParticipation(chat.id, b.id, 'leave')
      await startDirectChat(a.id, b.id)
      expect((await requireThread(b.id, chat.id)).canSend).toBe(false)
      await expect(message(chat.id, a.id)).rejects.toThrow('Both people')
      await expect(message(chat.id, b.id)).rejects.toThrow('Both people')
      await expect(
        changeDirectParticipation(chat.id, b.id, 'accept'),
      ).rejects.toThrow('No active invitation')
      await changeDirectParticipation(chat.id, a.id, 'invite')
      await expect(
        changeDirectParticipation(chat.id, a.id, 'accept'),
      ).rejects.toThrow('No active invitation')
      await changeDirectParticipation(chat.id, b.id, 'decline')
      expect((await requireThread(b.id, chat.id)).canSend).toBe(false)
      await changeDirectParticipation(chat.id, a.id, 'invite')
      await changeDirectParticipation(chat.id, b.id, 'accept')
      await message(chat.id, b.id)
      expect(
        await prisma.chatMessage.findUnique({ where: { id: sent.id } }),
      ).not.toBeNull()
      expect(
        await prisma.directConversation.count({ where: { id: chat.id } }),
      ).toBe(1)
    })
    it('allows both departed people to agree to resume the same conversation', async () => {
      const { a, b } = await connectedPair()
      const chat = await startDirectChat(a.id, b.id)
      await changeDirectParticipation(chat.id, a.id, 'leave')
      await changeDirectParticipation(chat.id, b.id, 'leave')
      await changeDirectParticipation(chat.id, a.id, 'invite')
      await changeDirectParticipation(chat.id, b.id, 'accept')
      expect((await requireThread(a.id, chat.id)).canSend).toBe(true)
    })
    it('does not let outsiders discover, join, invite or write an existing private chat', async () => {
      const { a, b } = await connectedPair(),
        outsider = await user()
      const chat = await startDirectChat(a.id, b.id)
      await expect(requireThread(outsider.id, chat.id)).rejects.toThrow(
        'Chat not found',
      )
      await expect(
        changeDirectParticipation(chat.id, outsider.id, 'invite'),
      ).rejects.toThrow('Chat not found')
      await expect(message(chat.id, outsider.id)).rejects.toThrow(
        'Chat not found',
      )
      await expect(startDirectChat(outsider.id, a.id)).rejects.toThrow(
        'Connect or share',
      )
    })
    it('removing a connection does not remove either user from an established chat', async () => {
      const { a, b } = await connectedPair()
      const chat = await startDirectChat(a.id, b.id)
      await prisma.userConnection.updateMany({
        where: { OR: [{ userLowId: a.id }, { userHighId: a.id }] },
        data: { status: 'REMOVED' },
      })
      expect((await requireThread(b.id, chat.id)).canSend).toBe(true)
      await message(chat.id, b.id)
    })
    it('locks completed rosters against stale sync, direct removal and reopening', async () => {
      const { a, b } = await connectedPair()
      const id = crypto.randomUUID()
      const trip = {
        id,
        userId: a.id,
        boatName: 'Test',
        startedAt: new Date(),
        status: 'COMPLETED' as const,
      }
      await prisma.$transaction((tx) =>
        syncTripParticipants(tx, trip, { crewUserIds: [b.id] }, a.id),
      )
      expect(await canAccess(b.id, 'view', { type: 'trip', id })).toBe(true)
      await expect(
        prisma.$transaction((tx) =>
          syncTripParticipants(tx, trip, { crewUserIds: [] }, a.id),
        ),
      ).rejects.toThrow('completed trip')
      await expect(
        prisma.tripParticipant.deleteMany({
          where: { tripId: id, userId: b.id },
        }),
      ).rejects.toThrow('completed trip')
      await expect(
        prisma.trip.update({ where: { id }, data: { status: 'IN_PROGRESS' } }),
      ).rejects.toThrow('completed trip')
      await prisma.userConnection.deleteMany({
        where: { OR: [{ userLowId: a.id }, { userHighId: a.id }] },
      })
      expect(await canAccess(b.id, 'view', { type: 'trip', id })).toBe(true)
      expect((await requireThread(b.id, `trip:${id}`)).memberIds).toContain(
        b.id,
      )
    })
    it('rejects non-users and unrelated accounts as newly selected crew', async () => {
      const a = await user(),
        outsider = await user()
      const trip = {
        id: crypto.randomUUID(),
        userId: a.id,
        boatName: 'Test',
        startedAt: new Date(),
      }
      await expect(
        prisma.$transaction((tx) =>
          syncTripParticipants(tx, trip, { crewUserIds: ['guest-name'] }, a.id),
        ),
      ).rejects.toThrow('registered users')
      await expect(
        prisma.$transaction((tx) =>
          syncTripParticipants(tx, trip, { crewUserIds: [outsider.id] }, a.id),
        ),
      ).rejects.toThrow('connect with this person')
      expect(
        await prisma.trip.findUnique({ where: { id: trip.id } }),
      ).toBeNull()
    })
    it('accepting a boat invite does not join its consortium or save a connection/contact', async () => {
      const a = await user(),
        b = await user()
      const org = await prisma.consortium.create({
        data: { name: 'Consortium', createdByUserId: a.id },
      })
      const boat = await prisma.boat.create({
        data: { name: 'Boat', userId: a.id, consortiumId: org.id },
      })
      const invite = await prisma.memberInvite.create({
        data: {
          kind: 'BOAT',
          boatId: boat.id,
          inviterUserId: a.id,
          inviteeEmail: b.email,
          token: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 60000),
        },
      })
      await acceptMemberInvite({
        token: invite.token,
        userId: b.id,
        userEmail: b.email,
      })
      expect(
        await prisma.boatMember.count({
          where: { boatId: boat.id, userId: b.id },
        }),
      ).toBe(1)
      expect(
        await prisma.consortiumMember.count({
          where: { consortiumId: org.id, userId: b.id },
        }),
      ).toBe(0)
      expect(
        await prisma.consortiumContact.count({
          where: { consortiumId: org.id, userId: b.id },
        }),
      ).toBe(0)
      expect(
        await prisma.userConnection.count({
          where: { OR: [{ userLowId: b.id }, { userHighId: b.id }] },
        }),
      ).toBe(0)
    })
    it('requires authenticated, mutual acceptance for connection requests', async () => {
      const a = await user(),
        b = await user()
      expect(
        (await request('/request', undefined, { userId: b.id })).status,
      ).toBe(401)
      expect((await request('/request', a.id, { userId: b.id })).status).toBe(
        200,
      )
      expect(await canStartDirectChat(a.id, b.id)).toBe(false)
      expect((await request(`/${b.id}/accept`, a.id)).status).toBe(409)
      expect((await request(`/${a.id}/accept`, b.id)).status).toBe(200)
      expect(await canStartDirectChat(a.id, b.id)).toBe(true)
      const chat = await startDirectChat(a.id, b.id)
      expect((await request(`/${b.id}/remove`, a.id)).status).toBe(200)
      expect((await requireThread(b.id, chat.id)).canSend).toBe(true)
    })

    it('accepts an emailed connection invitation only for its intended account, without adding membership', async () => {
      const a = await user(),
        b = await user(),
        wrong = await user()
      expect((await request('/invite', a.id, { email: b.email })).status).toBe(
        201,
      )
      expect(await hasPendingInviteForEmail(b.email)).toBe(true)
      const invite = await prisma.connectionInvite.findFirstOrThrow({
        where: { inviterUserId: a.id, inviteeEmail: b.email },
      })
      expect(
        (await request(`/invites/${invite.token}/accept`, wrong.id)).status,
      ).toBe(403)
      expect(
        (await request(`/invites/${invite.token}/accept`, b.id)).status,
      ).toBe(200)
      expect(
        (await request(`/invites/${invite.token}/accept`, b.id)).status,
      ).toBe(409)
      expect(await hasPendingInviteForEmail(b.email)).toBe(false)
      expect(await canStartDirectChat(a.id, b.id)).toBe(true)
      expect(
        await prisma.consortiumMember.count({ where: { userId: b.id } }),
      ).toBe(0)
      expect(await prisma.boatMember.count({ where: { userId: b.id } })).toBe(0)
    })

    it('ends consortium group access even for its creator when membership ends, preserving private chat', async () => {
      const a = await user(),
        b = await user()
      const org = await prisma.consortium.create({
        data: {
          name: 'Co-owners',
          createdByUserId: a.id,
          members: {
            create: [
              { userId: a.id, role: 'OWNER' },
              { userId: b.id, role: 'OWNER' },
            ],
          },
        },
      })
      expect(await canStartDirectChat(a.id, b.id)).toBe(true)
      const chat = await startDirectChat(a.id, b.id)
      await prisma.consortiumMember.deleteMany({
        where: { consortiumId: org.id, userId: a.id },
      })
      expect(await canStartDirectChat(a.id, b.id)).toBe(false)
      await expect(requireThread(a.id, `org:${org.id}`)).rejects.toThrow(
        'Chat not found',
      )
      expect((await requireThread(a.id, chat.id)).canSend).toBe(true)
    })
  },
)
