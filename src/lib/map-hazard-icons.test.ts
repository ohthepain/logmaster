import { describe, expect, it } from 'vitest'
import {
  HAZARD_NOTICE_ICON,
  HAZARD_OTHER_ICON,
  HAZARD_RESTRICTED_ICON,
  HAZARD_WRECK_ICON,
  hazardIconForKind,
} from './map-hazard-icons'

describe('map-hazard-icons', () => {
  it('maps hazard kinds to icon ids', () => {
    expect(hazardIconForKind('wreck')).toBe(HAZARD_WRECK_ICON)
    expect(hazardIconForKind('restricted')).toBe(HAZARD_RESTRICTED_ICON)
    expect(hazardIconForKind('notice')).toBe(HAZARD_NOTICE_ICON)
    expect(hazardIconForKind('other')).toBe(HAZARD_OTHER_ICON)
    expect(hazardIconForKind(undefined)).toBe(HAZARD_OTHER_ICON)
  })
})
