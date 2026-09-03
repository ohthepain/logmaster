import { describe, expect, it } from 'vitest'
import {
  aisCategoryForShipType,
  aisNavigationalStatusLabel,
  aisShipTypeLabel,
} from './ais-vessel-categories'

describe('ais-vessel-categories', () => {
  it('maps AIS ship types to MarineTraffic-style categories', () => {
    expect(aisCategoryForShipType(70)).toBe('cargo')
    expect(aisCategoryForShipType(80)).toBe('tanker')
    expect(aisCategoryForShipType(60)).toBe('passenger')
    expect(aisCategoryForShipType(40)).toBe('hsc')
    expect(aisCategoryForShipType(52)).toBe('tug_special')
    expect(aisCategoryForShipType(30)).toBe('fishing')
    expect(aisCategoryForShipType(37)).toBe('pleasure')
    expect(aisCategoryForShipType(null)).toBe('unspecified')
  })

  it('labels ship types and navigation status', () => {
    expect(aisShipTypeLabel(70)).toBe('Cargo')
    expect(aisNavigationalStatusLabel(1)).toBe('At anchor')
  })
})
