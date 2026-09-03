import { describe, expect, it } from 'vitest'
import { kindForTags, overpassQueryForCell } from './queries'

describe('osm-points queries', () => {
  it('maps seamark tags to UI kind filters', () => {
    expect(kindForTags('seamarks', { 'seamark:type': 'buoy' }, 'other')).toBe(
      'buoy',
    )
    expect(kindForTags('seamarks', { 'seamark:type': 'light_major' }, 'other')).toBe(
      'light',
    )
    expect(kindForTags('seamarks', { 'seamark:type': 'depth' }, 'other')).toBe(
      'depth',
    )
    expect(kindForTags('seamarks', { 'seamark:sounding:value': '12' }, 'other')).toBe(
      'depth',
    )
    expect(kindForTags('seamarks', { historic: 'wreck' }, 'other')).toBe('wreck')
  })

  it('maps place tags to coastal place kinds', () => {
    expect(kindForTags('places', { natural: 'bay' }, 'place')).toBe('bay')
    expect(kindForTags('places', { place: 'islet' }, 'place')).toBe('islet')
  })

  it('builds a compact seamarks Overpass union', () => {
    const query = overpassQueryForCell('seamarks', {
      south: 49.9,
      west: -8.2,
      north: 52.9,
      east: -5.2,
    })
    expect(query).toContain('seamark:type"~"^(buoy|beacon')
    expect(query).toContain('node["seamark:type"="depth"]')
    expect(query).toContain('node["seamark:sounding:value"]')
    expect(query).toContain('nwr["historic"="wreck"](49.9,-8.2,52.9,-5.2)')
    expect(query).not.toContain('nwr["seamark:type"="buoy"]')
  })
})
