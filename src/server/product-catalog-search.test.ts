import { describe, expect, it } from 'vitest'
import { catalogProductSearchWhere } from './product-catalog'

describe('catalogProductSearchWhere', () => {
  it('requires every query term to match model, alias, or localized name', () => {
    const where = catalogProductSearchWhere('victron', 'smart shunt')
    expect(where).toMatchObject({
      brandKey: 'victron',
      AND: expect.arrayContaining([
        expect.objectContaining({ OR: expect.any(Array) }),
        expect.objectContaining({ OR: expect.any(Array) }),
      ]),
    })
  })
})
