import { describe, expect, it } from 'vitest'
import { canTransitionClaimStatus, computeBankBalance } from './org-accounting'

describe('computeBankBalance', () => {
  it('returns opening balance when there are no transactions', () => {
    expect(computeBankBalance(1000, [])).toBe(1000)
  })

  it('sums signed transaction amounts onto opening balance', () => {
    expect(computeBankBalance(500, [-120.5, 50, -30])).toBe(399.5)
  })
})

describe('canTransitionClaimStatus', () => {
  it('allows draft to submitted', () => {
    expect(canTransitionClaimStatus('draft', 'submitted')).toBe(true)
  })

  it('allows submitted to approved and rejected', () => {
    expect(canTransitionClaimStatus('submitted', 'approved')).toBe(true)
    expect(canTransitionClaimStatus('submitted', 'rejected')).toBe(true)
  })

  it('allows approved to paid', () => {
    expect(canTransitionClaimStatus('approved', 'paid')).toBe(true)
  })

  it('blocks transitions from paid', () => {
    expect(canTransitionClaimStatus('paid', 'approved')).toBe(false)
    expect(canTransitionClaimStatus('paid', 'draft')).toBe(false)
  })

  it('allows same status', () => {
    expect(canTransitionClaimStatus('approved', 'approved')).toBe(true)
  })
})
