import { afterAll, describe, expect, it } from 'vitest'

// Opt-in only against the disposable local database, never the application's DB.
const enabled =
  process.env.ECONOMY_INTEGRATION === '1' &&
  [
    'postgresql://paulwilkinson@127.0.0.1:55439/postgres',
    'postgresql://paulwilkinson@127.0.0.1:55441/postgres',
  ].includes(process.env.DATABASE_URL ?? '')
describe.skipIf(!enabled)('doubloons with PostgreSQL', async () => {
  if (!enabled) {
    it.skip('requires disposable database', () => {})
    return
  }
  const { prisma } = await import('../db')
  const { ensureDirectChat } = await import('../messaging/direct-conversations')
  const {
    economyTransaction,
    ensureWallet,
    postTransaction,
    acceptEconomyInvite,
    payMiles,
  } = await import('./wallet')
  const { reconcileTripMileage, unlockTripMiles, setTripGifting } =
    await import('./mileage')
  const { encodePositionTrackSamples } = await import('../../domain/trip-track')
  const { visibleLogbook } = await import('./visibility')
  afterAll(async () => {
    await prisma.$disconnect()
  })
  async function user() {
    const id = crypto.randomUUID()
    return prisma.user.create({
      data: { id, name: id, email: `${id}@test.invalid` },
    })
  }
  async function setup() {
    const skipper = await user(),
      crew = await user()
    const trip = await prisma.trip.create({
      data: {
        userId: skipper.id,
        boatName: 'Test boat',
        startedAt: new Date(),
        status: 'IN_PROGRESS',
        participants: {
          create: [
            { userId: skipper.id, nameSnapshot: skipper.name },
            { userId: crew.id, nameSnapshot: crew.name },
          ],
        },
      },
    })
    await economyTransaction(async (tx) => {
      await ensureWallet(tx, skipper.id)
      await ensureWallet(tx, crew.id)
    })
    return { skipper, crew, trip }
  }
  async function empty(userId: string) {
    await economyTransaction(async (tx) => {
      const w = await ensureWallet(tx, userId)
      if (w.balance)
        await postTransaction(tx, {
          userId,
          amount: -w.balance,
          type: 'admin_adjustment',
          source: 'test',
          operationId: crypto.randomUUID(),
          idempotencyKey: crypto.randomUUID(),
        })
    })
  }
  it('creates exactly one welcome grant even under concurrent initialization', async () => {
    const u = await user()
    await Promise.all(
      Array.from({ length: 5 }, () =>
        economyTransaction((tx) => ensureWallet(tx, u.id)),
      ),
    )
    expect(
      (
        await prisma.doubloonWallet.findUniqueOrThrow({
          where: { userId: u.id },
        })
      ).balance,
    ).toBe(100)
    expect(
      await prisma.doubloonTransaction.count({ where: { userId: u.id } }),
    ).toBe(1)
  })
  it('makes ledger history immutable at the database boundary', async () => {
    const u = await user()
    await economyTransaction((tx) => ensureWallet(tx, u.id))
    await expect(
      prisma.doubloonTransaction.updateMany({
        where: { userId: u.id },
        data: { amount: 900 },
      }),
    ).rejects.toThrow('immutable')
    await expect(
      prisma.doubloonTransaction.deleteMany({ where: { userId: u.id } }),
    ).rejects.toThrow('immutable')
  })
  it('never changes the original inviter and makes accepting users contacts', async () => {
    const inviter = await user(),
      second = await user(),
      invitee = await user()
    const invite = {
      id: crypto.randomUUID(),
      inviterUserId: inviter.id,
      createdAt: new Date(Date.now() - 60000),
    }
    await economyTransaction((tx) =>
      acceptEconomyInvite(tx, invite, invitee.id),
    )
    await economyTransaction((tx) =>
      acceptEconomyInvite(
        tx,
        { ...invite, inviterUserId: second.id },
        invitee.id,
      ),
    )
    expect(
      (
        await prisma.doubloonReferral.findUniqueOrThrow({
          where: { inviteeId: invitee.id },
        })
      ).inviterId,
    ).toBe(inviter.id)
    expect(
      await prisma.friendRequest.count({
        where: { requesterUserId: invitee.id, status: 'ACCEPTED' },
      }),
    ).toBe(0)
  })
  it('counts a sponsored mile once, rewarding only the actual payer’s inviter', async () => {
    const { skipper, crew, trip } = await setup()
    const inviter = await user()
    await economyTransaction(async (tx) => {
      await ensureDirectChat(tx, crew.id, inviter.id)
      await acceptEconomyInvite(
        tx,
        {
          id: crypto.randomUUID(),
          inviterUserId: inviter.id,
          createdAt: new Date(Date.now() - 60000),
        },
        crew.id,
      )
      await payMiles(
        tx,
        crew.id,
        skipper.id,
        trip.id,
        5,
        crypto.randomUUID(),
        'unlock',
      )
    })
    expect(
      (
        await prisma.doubloonWallet.findUniqueOrThrow({
          where: { userId: skipper.id },
        })
      ).balance,
    ).toBe(100)
    expect(
      (
        await prisma.doubloonWallet.findUniqueOrThrow({
          where: { userId: crew.id },
        })
      ).balance,
    ).toBe(95)
    expect(
      (
        await prisma.doubloonWallet.findUniqueOrThrow({
          where: { userId: inviter.id },
        })
      ).balance,
    ).toBe(105)
    expect(
      await prisma.chatMessage.count({
        where: {
          senderId: crew.id,
          economyEvent: { path: ['type'], equals: 'referral_reward' },
        },
      }),
    ).toBe(1)
  })
  it('rejects partial payments, then unlocks all miles exactly once under a race', async () => {
    const { skipper, crew, trip } = await setup()
    await empty(skipper.id)
    const now = Date.now()
    await prisma.tripMile.createMany({
      data: [1, 2, 3].map((number) => ({
        tripId: trip.id,
        number,
        startedAt: new Date(now - 1000),
        endedAt: new Date(now),
      })),
    })
    await expect(
      unlockTripMiles(trip.id, skipper.id, 3, crypto.randomUUID()),
    ).rejects.toThrow('3 more')
    expect(
      await prisma.tripMile.count({ where: { tripId: trip.id, paidAt: null } }),
    ).toBe(3)
    const key = crypto.randomUUID()
    await Promise.all([
      unlockTripMiles(trip.id, crew.id, 3, key),
      unlockTripMiles(trip.id, crew.id, 3, key),
    ])
    expect(
      (
        await prisma.doubloonWallet.findUniqueOrThrow({
          where: { userId: crew.id },
        })
      ).balance,
    ).toBe(97)
    expect(
      await prisma.tripMile.count({ where: { tripId: trip.id, paidAt: null } }),
    ).toBe(0)
  })
  it('does not automatically settle arrears when credits arrive', async () => {
    const { skipper, trip } = await setup()
    await empty(skipper.id)
    await prisma.tripMile.create({
      data: {
        tripId: trip.id,
        number: 1,
        startedAt: new Date(),
        endedAt: new Date(),
      },
    })
    await economyTransaction((tx) =>
      postTransaction(tx, {
        userId: skipper.id,
        amount: 10,
        type: 'referral_reward',
        source: 'test',
        operationId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
      }),
    )
    await reconcileTripMileage(trip.id)
    expect(
      await prisma.tripMile.count({ where: { tripId: trip.id, paidAt: null } }),
    ).toBe(1)
    expect(
      (
        await prisma.doubloonWallet.findUniqueOrThrow({
          where: { userId: skipper.id },
        })
      ).balance,
    ).toBe(10)
  })
  it('meters logged distance once and hides unpaid logs without stopping the trip', async () => {
    const { skipper, trip } = await setup()
    await empty(skipper.id)
    // Move launch boundary back within this isolated database, not production.
    const start = Date.now() - 20 * 60000
    await prisma.doubloonPolicy.update({
      where: { id: 'v1' },
      data: { activatedAt: new Date(start - 1000) },
    })
    const samples = Array.from({ length: 11 }, (_, i) => ({
      time: new Date(start + i * 60000).toISOString(),
      latitude: i * 0.002,
      longitude: 0,
    }))
    await prisma.tripTrack.create({
      data: {
        tripId: trip.id,
        source: 'background-gps',
        kind: 'position',
        encoding: 'delta-v1',
        payload: encodePositionTrackSamples(samples),
        sampleCount: samples.length,
        startedAt: new Date(samples[0].time),
        endedAt: new Date(samples[10].time),
      },
    })
    await prisma.logEntry.create({
      data: {
        tripId: trip.id,
        type: 'NOTE',
        timestamp: new Date(samples[4].time),
        notes: 'Private unpaid log',
      },
    })
    await Promise.all([
      reconcileTripMileage(trip.id),
      reconcileTripMileage(trip.id),
    ])
    expect(await prisma.tripMile.count({ where: { tripId: trip.id } })).toBe(1)
    expect(
      (
        await prisma.doubloonWallet.findUniqueOrThrow({
          where: { userId: skipper.id },
        })
      ).remainderMetres,
    ).toBeGreaterThan(300)
    const snapshot = await visibleLogbook({
      trips: [trip],
      logEntries: await prisma.logEntry.findMany({
        where: { tripId: trip.id },
      }),
      tripTracks: await prisma.tripTrack.findMany({
        where: { tripId: trip.id },
      }),
      media: [],
    })
    expect(snapshot.logEntries).toHaveLength(0)
    expect(
      (await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).status,
    ).toBe('IN_PROGRESS')
  })
  it('limits gifting to selected crew and ends it with the trip', async () => {
    const { crew, trip } = await setup()
    const outsider = await user()
    await expect(setTripGifting(trip.id, outsider.id, true)).rejects.toThrow(
      'selected crew',
    )
    await setTripGifting(trip.id, crew.id, true)
    await prisma.trip.update({
      where: { id: trip.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    await reconcileTripMileage(trip.id)
    expect(
      await prisma.tripGifting.count({
        where: { tripId: trip.id, endedAt: null },
      }),
    ).toBe(0)
  })
  it('carries the skipper’s unfinished mile into another trip', async () => {
    const { skipper, trip } = await setup()
    const start = Date.now() - 30 * 60000
    await prisma.doubloonPolicy.update({
      where: { id: 'v1' },
      data: { activatedAt: new Date(start - 1000) },
    })
    const second = await prisma.trip.create({
      data: {
        userId: skipper.id,
        boatName: 'Second trip',
        startedAt: new Date(),
        status: 'IN_PROGRESS',
      },
    })
    for (const [index, target] of [trip, second].entries()) {
      const points = [0, 1].map((i) => ({
        time: new Date(start + (index * 600 + i * 120) * 1000).toISOString(),
        latitude: i * 0.01,
        longitude: 0,
      }))
      await prisma.tripTrack.create({
        data: {
          tripId: target.id,
          source: 'background-gps',
          payload: encodePositionTrackSamples(points),
          sampleCount: 2,
          startedAt: new Date(points[0].time),
          endedAt: new Date(points[1].time),
        },
      })
      await reconcileTripMileage(target.id)
    }
    expect(await prisma.tripMile.count({ where: { tripId: trip.id } })).toBe(0)
    expect(await prisma.tripMile.count({ where: { tripId: second.id } })).toBe(
      1,
    )
    expect(
      (
        await prisma.doubloonWallet.findUniqueOrThrow({
          where: { userId: skipper.id },
        })
      ).balance,
    ).toBe(99)
  })
  it('caps referral earnings even when welcome and credited doubloons both fund miles', async () => {
    const { skipper, crew, trip } = await setup()
    const inviter = await user()
    await economyTransaction(async (tx) => {
      await acceptEconomyInvite(
        tx,
        {
          id: crypto.randomUUID(),
          inviterUserId: inviter.id,
          createdAt: new Date(Date.now() - 60000),
        },
        crew.id,
      )
      await payMiles(
        tx,
        crew.id,
        skipper.id,
        trip.id,
        99,
        crypto.randomUUID(),
        'unlock',
      )
      await postTransaction(tx, {
        userId: crew.id,
        amount: 10,
        type: 'referral_reward',
        source: 'test',
        operationId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
      })
      await payMiles(
        tx,
        crew.id,
        skipper.id,
        trip.id,
        5,
        crypto.randomUUID(),
        'unlock',
      )
    })
    expect(
      (
        await prisma.doubloonReferral.findUniqueOrThrow({
          where: { inviteeId: crew.id },
        })
      ).rewarded,
    ).toBe(100)
    expect(
      (
        await prisma.doubloonWallet.findUniqueOrThrow({
          where: { userId: inviter.id },
        })
      ).balance,
    ).toBe(200)
  })
  it('rejects a competing full unlock by a different payer without charging them', async () => {
    const { skipper, crew, trip } = await setup()
    await prisma.tripMile.create({
      data: {
        tripId: trip.id,
        number: 1,
        startedAt: new Date(),
        endedAt: new Date(),
      },
    })
    const results = await Promise.allSettled([
      unlockTripMiles(trip.id, skipper.id, 1, crypto.randomUUID()),
      unlockTripMiles(trip.id, crew.id, 1, crypto.randomUUID()),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const wallets = await prisma.doubloonWallet.findMany({
      where: { userId: { in: [skipper.id, crew.id] } },
    })
    expect(wallets.reduce((total, w) => total + w.balance, 0)).toBe(199)
    expect(
      await prisma.doubloonTransaction.count({
        where: { tripId: trip.id, type: 'trip_charge' },
      }),
    ).toBe(1)
  })
  it('stops gifting immediately when another payment empties the giver’s wallet', async () => {
    const { crew, trip } = await setup()
    await setTripGifting(trip.id, crew.id, true)
    await empty(crew.id)
    expect(
      await prisma.tripGifting.count({
        where: { tripId: trip.id, endedAt: null },
      }),
    ).toBe(0)
    await economyTransaction((tx) =>
      postTransaction(tx, {
        userId: crew.id,
        amount: 10,
        type: 'admin_adjustment',
        source: 'test',
        operationId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
      }),
    )
    expect(
      await prisma.tripGifting.count({
        where: { tripId: trip.id, endedAt: null },
      }),
    ).toBe(0)
  })
})
