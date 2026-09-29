import { describe, expect, it } from 'vitest'
import {
  BOAT_ICON_IDS,
  boatIconSrc,
  DEFAULT_BOAT_ICON_ID,
  fittedBoatIconSize,
  isBoatIconId,
} from './boat-icons'
import { boatMapMarkerRotation } from './map-boat-marker'

describe('boat-icons', () => {
  it('resolves icon src from id', () => {
    expect(boatIconSrc('dinghy')).toBe('/boats/boat_dinghy.png')
    expect(boatIconSrc('invalid')).toBe(
      `/boats/boat_${DEFAULT_BOAT_ICON_ID}.png`,
    )
  })

  it('validates known icon ids', () => {
    for (const id of BOAT_ICON_IDS) {
      expect(isBoatIconId(id)).toBe(true)
    }
    expect(isBoatIconId('unknown')).toBe(false)
  })
})

describe('map-boat-marker', () => {
  it('keeps north-up icons unrotated', () => {
    expect(boatMapMarkerRotation(0)).toBe(0)
    expect(boatMapMarkerRotation(null)).toBe(0)
  })

  it('rotates to the heading when moving off north', () => {
    expect(boatMapMarkerRotation(90)).toBe(90)
    expect(boatMapMarkerRotation(225)).toBe(225)
  })
})

describe('fittedBoatIconSize', () => {
  it('keeps the sailboat artwork taller than it is wide', () => {
    const fitted = fittedBoatIconSize(47, 128)
    expect(fitted.height).toBeCloseTo(40)
    expect(fitted.width).toBeCloseTo(14.6875)
    expect(fitted.width / fitted.height).toBeCloseTo(47 / 128)
  })

  it('fits a wider icon inside the marker box', () => {
    const fitted = fittedBoatIconSize(100, 128)
    expect(fitted.height).toBeCloseTo(40)
    expect(fitted.width).toBeCloseTo(31.25)
    expect(fitted.width / fitted.height).toBeCloseTo(100 / 128)
  })
})
