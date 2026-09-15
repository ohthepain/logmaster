import { describe, expect, it } from 'vitest'
import { listableBoatAssetsWhere } from './boat-network-assets'

describe('listableBoatAssetsWhere', () => {
  it('includes equipment and visible networks only', () => {
    expect(listableBoatAssetsWhere('boat')).toMatchObject({
      boatId: 'boat',
      OR: expect.arrayContaining([
        { kind: 'equipment' },
        expect.objectContaining({ kind: 'system_network' }),
      ]),
    })
  })
})
