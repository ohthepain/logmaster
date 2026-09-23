import { apiUrl } from './app-origin'
import type { DoubloonTransactionType } from '../domain/doubloons'

export type EconomyTrip = {
  id: string
  title: string
  skipperId: string
  active: boolean
  unpaidMiles: number
  giver: { id: string; name: string } | null
  nextGiftNm: number
}
export type DoubloonAccount = {
  userId: string
  balance: number
  trips: EconomyTrip[]
  referrals: { userId: string; name: string; credited: number; limit: number }[]
  purchasesAvailable: boolean
}
export type WalletActivity = {
  id: string
  amount: number
  type: DoubloonTransactionType
  source: string
  tripId: string | null
  relatedUserId: string | null
  createdAt: string
  resultingBalance: number
  operationId: string
}
export async function economyRequest<T>(path = '', body?: unknown): Promise<T> {
  const response = await fetch(apiUrl(`/api/doubloons${path}`), {
    credentials: 'include',
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Could not load doubloons')
  return result as T
}
export const fetchDoubloonAccount = () => economyRequest<DoubloonAccount>()
export const fetchDoubloonActivity = (before?: number) =>
  economyRequest<{ transactions: WalletActivity[]; nextBefore: number | null }>(
    `/activity${before ? `?before=${before}` : ''}`,
  )
