import { describe, expect, it } from 'vitest'
import { CANADA_MARINA_BBOX, NORTH_AMERICA_MARINA_BBOX } from './bboxes'
import { gridCellsForBbox } from './grid'
import {
  formatOverpassErrorCode,
  formatMarinaCellLogLine,
  isBrokenOverpassPayload,
  overpassElementToMarina,
  overpassMirrorUrls,
  overpassQueryForCell,
} from './overpass'
import { mergeMarinaFeatures } from './schema'

describe('marina grid', () => {
  it('builds 3-degree cells for Canada bbox', () => {
    const cells = gridCellsForBbox(CANADA_MARINA_BBOX, 3)
    expect(cells.length).toBeGreaterThan(0)
    expect(cells[0]).toMatchObject({
      south: expect.any(Number),
      west: expect.any(Number),
      north: expect.any(Number),
      east: expect.any(Number),
    })
  })

  it('covers North America in a manageable number of 3-degree cells', () => {
    const cells = gridCellsForBbox(NORTH_AMERICA_MARINA_BBOX, 3)
    expect(cells.length).toBe(760)
    expect(cells.length).toBeLessThan(1000)
  })
})

describe('overpass marina parsing', () => {
  it('detects broken Overpass payloads with invalid timestamps', () => {
    expect(
      isBrokenOverpassPayload({
        osm3s: { timestamp_osm_base: '116106' },
        elements: [],
      }),
    ).toBe(true)
    expect(
      isBrokenOverpassPayload({
        osm3s: { timestamp_osm_base: '2026-08-02T16:27:06Z' },
        elements: [],
      }),
    ).toBe(false)
  })

  it('prefers configured Overpass URL then falls back to defaults', () => {
    expect(overpassMirrorUrls(null)).toEqual([
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass-api.de/api/interpreter',
    ])
    expect(
      overpassMirrorUrls('https://overpass.osm.ch/api/interpreter'),
    ).toEqual([
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass-api.de/api/interpreter',
    ])
  })

  it('formats cell log lines with OK and FAIL status', () => {
    const cell = { south: 42, west: -141, north: 45, east: -138 }
    expect(
      formatMarinaCellLogLine({
        index: 1,
        total: 300,
        cell,
        status: 'ok',
        featureCount: 0,
      }),
    ).toBe('[marinas] cell 1/300 [42,-141,45,-138] OK · 0 features')
    expect(
      formatMarinaCellLogLine({
        index: 23,
        total: 300,
        cell,
        status: 'failed',
        featureCount: 0,
        errorCode: '504',
        pass: 1,
      }),
    ).toBe('[marinas] cell 23/300 retry-1 [42,-141,45,-138] FAIL 504 · 0 features')
    expect(formatOverpassErrorCode('Overpass 504: gateway timeout')).toBe('504')
    expect(formatOverpassErrorCode('Cell query timed out')).toBe('CELL_TIMEOUT')
    expect(formatOverpassErrorCode('Overpass timeout: too busy')).toBe('TIMEOUT')
  })

  it('builds expected Overpass QL', () => {
    const query = overpassQueryForCell({
      south: 42,
      west: -141,
      north: 45,
      east: -138,
    })
    expect(query).toContain('nwr["leisure"="marina"](42,-141,45,-138)')
    expect(query).toContain('out center tags')
  })

  it('normalizes node and way center elements', () => {
    const node = overpassElementToMarina({
      type: 'node',
      id: 42,
      lat: 43.65,
      lon: -79.38,
      tags: { leisure: 'marina', name: 'Harbourfront' },
    })
    expect(node?.properties.id).toBe('osm:node/42')
    expect(node?.properties.name).toBe('Harbourfront')

    const way = overpassElementToMarina({
      type: 'way',
      id: 99,
      center: { lat: 44.1, lon: -78.9 },
      tags: { 'seamark:type': 'marina', 'seamark:name': 'Bay Marina' },
    })
    expect(way?.properties.id).toBe('osm:way/99')
    expect(way?.properties.name).toBe('Bay Marina')
  })

  it('dedupes marinas by osm id', () => {
    const merged = mergeMarinaFeatures([
      overpassElementToMarina({
        type: 'node',
        id: 1,
        lat: 1,
        lon: 2,
        tags: { name: 'A' },
      })!,
      overpassElementToMarina({
        type: 'node',
        id: 1,
        lat: 1,
        lon: 2,
        tags: { name: 'B' },
      })!,
    ])
    expect(merged).toHaveLength(1)
  })
})
