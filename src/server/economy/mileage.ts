import { prisma } from '../db'
import { readTrackObjectBytes } from '../s3-tracks'
import { deserializeTrackPayload } from '../../lib/trip-track-payload'
import { decodePositionTrackSamples } from '../../domain/trip-track'
import type {
  PositionTrackSample,
  TripTrackDeltaV1,
} from '../../domain/trip-track'
import { loggedMetres, METRES_PER_NM, unlockCost } from '../../domain/doubloons'
import { economyTransaction, ensureWallet, payMiles } from './wallet'
import type { EconomyTx } from './wallet'

export async function tripParticipants(tx: EconomyTx, tripId: string) {
  const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId } })
  if (!trip.userId) throw new Error('Trip has no skipper account')
  const crew = await tx.tripParticipant.findMany({
    where: { tripId, userId: { not: trip.userId } },
  })
  return {
    trip,
    skipperId: trip.userId,
    crewIds: crew.map((c) => c.userId),
  }
}

export async function closeInvalidGifting(tx: EconomyTx, tripId: string) {
  const { trip, crewIds } = await tripParticipants(tx, tripId)
  await tx.tripGifting.updateMany({
    where: {
      tripId,
      endedAt: null,
      ...(trip.status === 'IN_PROGRESS' ? { userId: { notIn: crewIds } } : {}),
    },
    data: { endedAt: trip.completedAt ?? new Date() },
  })
}

/** Billing consumes raw samples, never redacted replay payloads. No back-billing
 * of pre-launch history. Duplicate/open/sealed overlapping samples share a cursor.
 */
export async function reconcileTripMileage(tripId: string) {
  const policy = await prisma.doubloonPolicy.findUniqueOrThrow({
    where: { id: 'v1' },
  })
  const tracks = await prisma.tripTrack.findMany({
    where: {
      tripId,
      kind: 'position',
      source: { not: 'gpx-import' },
      endedAt: { gte: policy.activatedAt },
    },
    orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
  })
  const samples: PositionTrackSample[] = []
  for (const track of tracks) {
    const payload =
      track.storage === 's3' && track.storageKey
        ? await deserializeTrackPayload(
            new Uint8Array(await readTrackObjectBytes(track.storageKey)),
          )
        : track.payload
    if (!payload) continue
    samples.push(
      ...decodePositionTrackSamples(payload as TripTrackDeltaV1).filter(
        (s) =>
          Date.parse(s.time) >= policy.activatedAt.getTime() &&
          Date.parse(s.time) <= Date.now() + 60000,
      ),
    )
  }
  samples.sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
  return economyTransaction(async (tx) => {
    const { trip, skipperId } = await tripParticipants(tx, tripId)
    await closeInvalidGifting(tx, tripId)
    const wallet = await ensureWallet(tx, skipperId)
    const state = await tx.tripMileage.upsert({
      where: { tripId },
      create: { tripId, skipperId },
      update: {},
    })
    let last = state.lastSample as PositionTrackSample | null
    let remainder = wallet.remainderMetres
    let start = state.partialStartedAt
    let number = state.nextMile
    const gifts = await tx.tripGifting.findMany({
      where: { tripId },
      orderBy: { startedAt: 'asc' },
    })
    for (const sample of samples) {
      if (last && Date.parse(sample.time) <= Date.parse(last.time)) continue
      if (
        trip.completedAt &&
        Date.parse(sample.time) > trip.completedAt.getTime()
      )
        continue
      if (!last) {
        last = sample
        start = new Date(sample.time)
        continue
      }
      let distance = loggedMetres(last, sample)
      const total = distance
      let traversed = 0
      while (distance + remainder >= METRES_PER_NM) {
        const consumed = METRES_PER_NM - remainder
        traversed += consumed
        distance -= consumed
        const at = new Date(
          Date.parse(last.time) +
            ((Date.parse(sample.time) - Date.parse(last.time)) * traversed) /
              total,
        )
        const gift = gifts.find(
          (g) => g.startedAt <= at && (!g.endedAt || g.endedAt > at),
        )
        let payerId = skipperId
        if (gift) {
          const giverWallet = await ensureWallet(tx, gift.userId)
          if (giverWallet.balance > 0) payerId = gift.userId
          else if (!gift.endedAt) {
            gift.endedAt = at
            await tx.tripGifting.update({
              where: { id: gift.id },
              data: { endedAt: at },
            })
          }
        }
        const payer = await ensureWallet(tx, payerId)
        const operationId = `mile:${tripId}:${number}`
        const paid = payer.balance > 0
        if (paid)
          await payMiles(tx, payerId, skipperId, tripId, 1, operationId, 'mile')
        await tx.tripMile.create({
          data: {
            tripId,
            number,
            startedAt: start ?? new Date(last.time),
            endedAt: at,
            payerId: paid ? payerId : null,
            paidAt: paid ? new Date() : null,
            operationId: paid ? operationId : null,
          },
        })
        if (
          gift &&
          payerId === gift.userId &&
          (await ensureWallet(tx, payerId)).balance === 0 &&
          !gift.endedAt
        ) {
          gift.endedAt = at
          await tx.tripGifting.update({
            where: { id: gift.id },
            data: { endedAt: at },
          })
        }
        number++
        remainder = 0
        start = at
      }
      remainder += distance
      last = sample
    }
    await tx.doubloonWallet.update({
      where: { userId: skipperId },
      data: { remainderMetres: remainder },
    })
    await tx.tripMileage.update({
      where: { tripId },
      data: {
        lastSample: last ?? undefined,
        sampleThrough: last ? new Date(last.time) : null,
        partialStartedAt: start,
        nextMile: number,
      },
    })
    await closeInvalidGifting(tx, tripId)
    await refreshHiddenEntries(tx, tripId)
  })
}

export async function refreshHiddenEntries(tx: EconomyTx, tripId: string) {
  const unpaid = await tx.tripMile.findMany({ where: { tripId, paidAt: null } })
  await tx.logEntry.updateMany({
    where: { tripId, economyHidden: true },
    data: { economyHidden: false },
  })
  if (unpaid.length)
    await tx.logEntry.updateMany({
      where: {
        tripId,
        OR: unpaid.map((m) => ({
          timestamp: { gt: m.startedAt, lte: m.endedAt },
        })),
      },
      data: { economyHidden: true },
    })
}

export async function setTripGifting(
  tripId: string,
  userId: string,
  enabled: boolean,
) {
  const access = await tripParticipants(prisma, tripId)
  if (userId !== access.skipperId && !access.crewIds.includes(userId))
    throw new Error(
      'Only the skipper or selected crew can access trip payments',
    )
  await reconcileTripMileage(tripId)
  return economyTransaction(async (tx) => {
    const { trip, crewIds } = await tripParticipants(tx, tripId)
    if (!crewIds.includes(userId))
      throw new Error('Only selected crew can gift doubloons on this trip')
    await closeInvalidGifting(tx, tripId)
    if (!enabled) {
      await tx.tripGifting.updateMany({
        where: { tripId, userId, endedAt: null },
        data: { endedAt: new Date() },
      })
      return
    }
    if (trip.status !== 'IN_PROGRESS')
      throw new Error('Gifting is available during an active trip')
    const active = await tx.tripGifting.findFirst({
      where: { tripId, endedAt: null },
    })
    if (active?.userId === userId) return
    if (active) throw new Error('Another crew member is already gifting')
    if ((await ensureWallet(tx, userId)).balance < 1)
      throw new Error('You need a doubloon to start gifting')
    await tx.tripGifting.create({ data: { tripId, userId } })
  })
}

export async function unlockTripMiles(
  tripId: string,
  userId: string,
  expectedMiles: number,
  requestId: string,
) {
  const access = await tripParticipants(prisma, tripId)
  if (userId !== access.skipperId && !access.crewIds.includes(userId))
    throw new Error(
      'Only the skipper or selected crew can access trip payments',
    )
  await reconcileTripMileage(tripId)
  return economyTransaction(async (tx) => {
    const { skipperId, crewIds } = await tripParticipants(tx, tripId)
    if (userId !== skipperId && !crewIds.includes(userId))
      throw new Error('Only the skipper or selected crew can unlock this trip')
    const operationId = `unlock:${userId}:${tripId}:${requestId}`
    if (
      await tx.doubloonTransaction.findUnique({
        where: { idempotencyKey: `${operationId}:charge` },
      })
    )
      return
    const miles = await tx.tripMile.findMany({
      where: { tripId, paidAt: null },
    })
    if (miles.length !== expectedMiles)
      throw new Error(
        'Unpaid mileage changed. Review the new total before unlocking.',
      )
    if (!miles.length) return
    const payer = await ensureWallet(tx, userId)
    const cost = unlockCost(miles.length, payer.balance)
    await payMiles(tx, userId, skipperId, tripId, cost, operationId, 'unlock')
    await tx.tripMile.updateMany({
      where: { id: { in: miles.map((m) => m.id) }, paidAt: null },
      data: { payerId: userId, paidAt: new Date(), operationId },
    })
    await refreshHiddenEntries(tx, tripId)
  })
}
