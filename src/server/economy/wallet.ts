import type { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../db'
import {
  directThreadId,
  lockDirectChat,
} from '../messaging/direct-conversations'
import { referralAmount, WELCOME_DOUBLOONS } from '../../domain/doubloons'
import type { DoubloonTransactionType } from '../../domain/doubloons'

export type EconomyTx = Prisma.TransactionClient

/** One transaction lock orders wallet, gifting, referral and usage writes alike.
 * This favors auditability over throughput; shard only with a stable lock order.
 */
export async function economyTransaction<T>(
  work: (tx: EconomyTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(731924061)`
      return work(tx)
    },
    { maxWait: 15000, timeout: 30000 },
  )
}

export async function ensureWallet(tx: EconomyTx, userId: string) {
  const existing = await tx.doubloonWallet.findUnique({ where: { userId } })
  if (existing) return existing
  // A lazily initialized wallet gives the existing community the same welcome.
  await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true },
  })
  const wallet = await tx.doubloonWallet.create({
    data: { userId, balance: WELCOME_DOUBLOONS, sequence: 1 },
  })
  await tx.doubloonTransaction.create({
    data: {
      userId,
      amount: WELCOME_DOUBLOONS,
      type: 'welcome_grant',
      source: 'welcome',
      resultingBalance: WELCOME_DOUBLOONS,
      sequence: 1,
      operationId: `welcome:${userId}`,
      idempotencyKey: `welcome:${userId}`,
    },
  })
  return wallet
}

export async function postTransaction(
  tx: EconomyTx,
  input: {
    userId: string
    amount: number
    type: DoubloonTransactionType
    source: string
    operationId: string
    idempotencyKey: string
    tripId?: string
    relatedUserId?: string
    reversalOfId?: string
  },
) {
  const prior = await tx.doubloonTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (prior) return prior
  if (!Number.isSafeInteger(input.amount) || !input.amount)
    throw new Error('Invalid doubloon amount')
  const wallet = await ensureWallet(tx, input.userId)
  const resultingBalance = wallet.balance + input.amount
  if (resultingBalance < 0) throw new Error('Not enough doubloons')
  const sequence = wallet.sequence + 1
  await tx.doubloonWallet.update({
    where: { userId: input.userId },
    data: { balance: resultingBalance, sequence },
  })
  if (resultingBalance === 0) {
    await tx.tripGifting.updateMany({
      where: { userId: input.userId, endedAt: null },
      data: { endedAt: new Date() },
    })
  }
  return tx.doubloonTransaction.create({
    data: { ...input, resultingBalance, sequence },
  })
}

/** Reward the actual funder, never the captain's pass-through gift credit. */
export async function rewardReferral(
  tx: EconomyTx,
  payerId: string,
  amount: number,
  operationId: string,
  tripId: string,
) {
  const referral = await tx.doubloonReferral.findUnique({
    where: { inviteeId: payerId },
  })
  if (!referral) return
  const reward = referralAmount(amount, referral.rewarded)
  if (!reward) return
  const key = `${operationId}:referral`
  if (
    await tx.doubloonTransaction.findUnique({ where: { idempotencyKey: key } })
  )
    return
  const transaction = await postTransaction(tx, {
    userId: referral.inviterId,
    amount: reward,
    type: 'referral_reward',
    source: 'sailing',
    relatedUserId: payerId,
    tripId,
    operationId,
    idempotencyKey: key,
  })
  await tx.doubloonReferral.update({
    where: { inviteeId: payerId },
    data: { rewarded: { increment: reward } },
  })
  const threadId = directThreadId(payerId, referral.inviterId)
  await lockDirectChat(tx, threadId)
  const conversation = await tx.directConversation.findUnique({
    where: { id: threadId },
    include: { participants: true },
  })
  if (!conversation || conversation.participants.some((p) => p.leftAt)) return
  // The durable chat outbox publishes only after the wallet transaction commits.
  await tx.chatMessage.create({
    data: {
      id: transaction.id,
      threadId,
      senderId: payerId,
      text: `My sailing earned you ${reward} doubloon${reward === 1 ? '' : 's'}! ${referral.rewarded + reward} of 100 invitation doubloons collected.`,
      references: [],
      economyEvent: {
        type: 'referral_reward',
        version: 1,
        transactionId: transaction.id,
        amount: reward,
        total: referral.rewarded + reward,
      },
    },
  })
}

export async function payMiles(
  tx: EconomyTx,
  payerId: string,
  skipperId: string,
  tripId: string,
  amount: number,
  operationId: string,
  source: 'mile' | 'unlock',
) {
  if (payerId !== skipperId) {
    await postTransaction(tx, {
      userId: payerId,
      amount: -amount,
      type: 'trip_gift',
      source,
      tripId,
      relatedUserId: skipperId,
      operationId,
      idempotencyKey: `${operationId}:gift-out`,
    })
    await postTransaction(tx, {
      userId: skipperId,
      amount,
      type: 'trip_gift',
      source,
      tripId,
      relatedUserId: payerId,
      operationId,
      idempotencyKey: `${operationId}:gift-in`,
    })
  }
  await postTransaction(tx, {
    userId: skipperId,
    amount: -amount,
    type: 'trip_charge',
    source,
    tripId,
    relatedUserId: payerId,
    operationId,
    idempotencyKey: `${operationId}:charge`,
  })
  await rewardReferral(tx, payerId, amount, operationId, tripId)
}

/** Called within invite acceptance's transaction. The first qualifying invite wins. */
export async function acceptEconomyInvite(
  tx: EconomyTx,
  invite: { id: string; inviterUserId: string; createdAt: Date },
  inviteeId: string,
) {
  if (invite.inviterUserId === inviteeId) return
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(731924061)`
  const user = await tx.user.findUniqueOrThrow({
    where: { id: inviteeId },
    select: { createdAt: true },
  })
  // Existing accounts do not qualify for a fresh referral allowance.
  if (user.createdAt < invite.createdAt) return
  await tx.doubloonReferral.upsert({
    where: { inviteeId },
    create: { inviteeId, inviterId: invite.inviterUserId, inviteId: invite.id },
    update: {},
  })
}
