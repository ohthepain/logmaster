import { describe, expect, it } from 'vitest'
import {
  defaultShareLabel,
  serializeBoatShares,
  userBoatOwnershipFraction,
} from './boat-shares'

describe('boat-shares', () => {
  it('orders shares by sequence and owners by name', () => {
    const shares = serializeBoatShares([
      {
        id: 's2',
        boatId: 'b1',
        sequence: 1,
        label: null,
        owners: [
          {
            userId: 'u2',
            user: {
              id: 'u2',
              name: 'Zoe',
              email: 'zoe@example.com',
              image: null,
            },
          },
        ],
      },
      {
        id: 's1',
        boatId: 'b1',
        sequence: 0,
        label: 'Prime week',
        owners: [
          {
            userId: 'u2',
            user: {
              id: 'u2',
              name: 'Zoe',
              email: 'zoe@example.com',
              image: null,
            },
          },
          {
            userId: 'u1',
            user: {
              id: 'u1',
              name: 'Alex',
              email: 'alex@example.com',
              image: null,
            },
          },
        ],
      },
    ])

    expect(shares.map((share) => share.sequence)).toEqual([0, 1])
    expect(shares[0]?.displayName).toBe('Prime week')
    expect(shares[1]?.displayName).toBe('Share 2')
    expect(shares[0]?.owners.map((owner) => owner.name)).toEqual(['Alex', 'Zoe'])
  })

  it('calculates equal fractional ownership within a share', () => {
    const shares = serializeBoatShares([
      {
        id: 's1',
        boatId: 'b1',
        sequence: 0,
        label: null,
        owners: [
          {
            userId: 'u1',
            user: {
              id: 'u1',
              name: 'Alex',
              email: 'alex@example.com',
              image: null,
            },
          },
          {
            userId: 'u2',
            user: {
              id: 'u2',
              name: 'Zoe',
              email: 'zoe@example.com',
              image: null,
            },
          },
        ],
      },
      {
        id: 's2',
        boatId: 'b1',
        sequence: 1,
        label: null,
        owners: [
          {
            userId: 'u1',
            user: {
              id: 'u1',
              name: 'Alex',
              email: 'alex@example.com',
              image: null,
            },
          },
        ],
      },
    ])

    expect(userBoatOwnershipFraction(shares, 'u1')).toBe(1.5)
    expect(userBoatOwnershipFraction(shares, 'u2')).toBe(0.5)
  })

  it('uses 1-based labels by default', () => {
    expect(defaultShareLabel(0)).toBe('Share 1')
    expect(defaultShareLabel(3)).toBe('Share 4')
  })
})
