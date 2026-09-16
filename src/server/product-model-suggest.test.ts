import { describe, expect, it } from 'vitest'
import {
  equipmentModelSuggestSchema,
  sanitizeEquipmentModelSuggest,
} from './product-model-suggest'

describe('sanitizeEquipmentModelSuggest', () => {
  it('keeps verified product image URLs and drops invalid ones', () => {
    const parsed = equipmentModelSuggestSchema.parse({
      brandCorrect: false,
      brandGuesses: ['Victron Energy'],
      ambiguous: true,
      products: [
        {
          brand: 'Victron Energy',
          modelNumber: 'SHU050130050',
          name: 'SmartShunt 300A IP65',
          description: 'Battery monitor shunt',
          imageUrl: 'https://www.victronenergy.com/upload/shunt.png',
          productPageUrl:
            'https://www.victronenergy.com/battery-monitors/smartshunt',
          specifications: [{ name: 'Current', value: '300', unit: 'A' }],
        },
        {
          brand: 'Victron Energy',
          modelNumber: 'LYNX',
          name: 'Lynx shunt',
          description: 'Not this one',
          imageUrl: 'javascript:alert(1)',
          productPageUrl: '',
          specifications: [],
        },
      ],
    })
    const result = sanitizeEquipmentModelSuggest(parsed)
    expect(result.brandCorrect).toBe(false)
    expect(result.brandGuesses).toEqual(['Victron Energy'])
    expect(result.ambiguous).toBe(true)
    expect(result.options[0]?.imageUrl).toBe(
      'https://www.victronenergy.com/upload/shunt.png',
    )
    expect(result.options[1]?.imageUrl).toBeNull()
    expect(result.options[1]?.productPageUrl).toBeNull()
    expect(result.products).toEqual([])
  })

  it('treats a single matching product as unambiguous', () => {
    const result = sanitizeEquipmentModelSuggest({
      brandCorrect: true,
      brandGuesses: [],
      ambiguous: true,
      products: [
        {
          brand: 'Garmin',
          modelNumber: '923',
          name: 'Chartplotter',
          description: 'Display',
          imageUrl: 'https://example.com/923.jpg',
          productPageUrl: null,
          specifications: [],
        },
      ],
    })
    expect(result.ambiguous).toBe(false)
    expect(result.options).toHaveLength(1)
  })
})
