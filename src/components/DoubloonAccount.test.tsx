// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DoubloonAccountModal } from './DoubloonAccount'

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  activity: vi.fn(),
  request: vi.fn(),
  sync: vi.fn(),
}))
vi.mock('../lib/doubloons-api', () => ({
  fetchDoubloonAccount: mocks.account,
  fetchDoubloonActivity: mocks.activity,
  economyRequest: mocks.request,
}))
vi.mock('../stores/logbook', () => ({
  useLogbookStore: { getState: () => ({ syncNow: mocks.sync }) },
}))
vi.mock('./Modal', () => ({
  Modal: ({ title, children }: { title: string; children: ReactNode }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}))
const trip = {
  id: 'trip',
  title: 'Sunday sail',
  skipperId: 'skipper',
  active: true,
  unpaidMiles: 24,
  giver: null,
  nextGiftNm: 0.36,
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.account.mockResolvedValue({
    userId: 'crew',
    balance: 40,
    trips: [trip],
    referrals: [{ userId: 'maya', name: 'Maya', credited: 25, limit: 100 }],
    purchasesAvailable: false,
  })
  mocks.activity.mockResolvedValue({ transactions: [], nextBefore: null })
  mocks.request.mockResolvedValue({ ok: true })
  mocks.sync.mockResolvedValue(true)
})
afterEach(cleanup)
it('shows credits without spending them and requires the explicit full-trip unlock', async () => {
  render(<DoubloonAccountModal initialTripId="trip" onClose={() => {}} />)
  const pay = await screen.findByRole('button', {
    name: 'Unlock for 24 doubloons',
  })
  expect(mocks.request).not.toHaveBeenCalled()
  fireEvent.click(pay)
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith('/trips/trip/unlock', {
      expectedMiles: 24,
      requestId: expect.any(String),
    }),
  )
  await waitFor(() => expect(mocks.sync).toHaveBeenCalledOnce())
})
it('does not offer a partial unlock when the wallet is short', async () => {
  mocks.account.mockResolvedValue({
    userId: 'crew',
    balance: 23,
    trips: [trip],
    referrals: [],
    purchasesAvailable: false,
  })
  render(<DoubloonAccountModal initialTripId="trip" onClose={() => {}} />)
  const pay = await screen.findByRole('button', {
    name: 'Unlock for 24 doubloons',
  })
  expect(pay.hasAttribute('disabled')).toBe(true)
  expect(screen.getByText(/You need 1 more doubloons/)).toBeTruthy()
  fireEvent.click(pay)
  expect(mocks.request).not.toHaveBeenCalled()
})
it('explains the next mile and exposes the gifting toggle only to an available giver', async () => {
  render(<DoubloonAccountModal onClose={() => {}} />)
  fireEvent.click(
    await screen.findByRole('button', { name: /Sunday sail.*Give doubloons/ }),
  )
  expect(await screen.findByText('0.36 nm')).toBeTruthy()
  fireEvent.click(screen.getByRole('switch', { name: 'Gifting' }))
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith('/trips/trip/gifting', {
      enabled: true,
    }),
  )
})
