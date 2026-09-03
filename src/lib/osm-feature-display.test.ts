import { describe, expect, it } from 'vitest'
import {
  formatLightCharacteristicFromBase,
  formatLightCharacteristics,
  formatMapFeaturePopupHtml,
  formatOsmDepthLabel,
  osmColourNameToHex,
  osmLightColourNames,
  osmLightDisplayColor,
  parseOsmFeatureTags,
} from './osm-feature-display'

describe('osm-feature-display', () => {
  it('maps OSM light colour names to chart hex values', () => {
    expect(osmColourNameToHex('Red')).toBe('#ef4444')
    expect(osmColourNameToHex('white')).toBe('#f8fafc')
    expect(osmColourNameToHex('unknown')).toBeNull()
  })

  it('collects multi-sector light colours', () => {
    expect(
      osmLightColourNames({
        'seamark:light:colour': 'Red;White',
        'seamark:light:2:colour': 'Green',
      }),
    ).toEqual(['Red', 'White', 'Green'])
  })

  it('uses the first known light colour for marker paint', () => {
    expect(
      osmLightDisplayColor({
        'seamark:light:colour': 'Green',
      }),
    ).toBe('#22c55e')
    expect(osmLightDisplayColor({})).toBe('#fde047')
  })

  it('formats OSM depth labels for map display', () => {
    expect(formatOsmDepthLabel({ depth: '12' })).toBe('12 m')
    expect(formatOsmDepthLabel({ 'seamark:depth': '4.5 m' })).toBe('4.5 m')
    expect(formatOsmDepthLabel({ 'seamark:sounding:value': '8' })).toBe('8 m')
    expect(formatOsmDepthLabel({})).toBeNull()
  })

  it('parses stringified GeoJSON tags', () => {
    expect(parseOsmFeatureTags('{"seamark:type":"wreck","depth":"12"}')).toEqual({
      'seamark:type': 'wreck',
      depth: '12',
    })
  })

  it('builds chart-style light characteristics from OSM tags', () => {
    expect(
      formatLightCharacteristicFromBase(
        {
          'seamark:light:character': 'F',
          'seamark:light:colour': 'green',
          'seamark:light:multiple': '2',
          'seamark:light:category': 'vertical',
          'seamark:light:range': '2',
        },
        'seamark:light',
      ),
    ).toBe('2F.G(vert)2M')

    expect(
      formatLightCharacteristicFromBase(
        {
          'seamark:light:character': 'Fl',
          'seamark:light:colour': 'green',
          'seamark:light:group': '2',
          'seamark:light:period': '5',
          'seamark:light:range': '2',
        },
        'seamark:light',
      ),
    ).toBe('Fl(2).G 5s 2M')

    expect(
      formatLightCharacteristics({
        'seamark:light:1:character': 'Fl',
        'seamark:light:1:colour': 'white',
        'seamark:light:1:period': '10',
        'seamark:light:1:range': '12',
        'seamark:light:1:sector_start': '262',
        'seamark:light:1:sector_end': '208',
        'seamark:light:2:character': 'Fl',
        'seamark:light:2:colour': 'red',
        'seamark:light:2:range': '9',
        'seamark:light:2:sector_start': '208',
        'seamark:light:2:sector_end': '262',
      }),
    ).toEqual([
      'Fl.W 10s 12M (262°–208°)',
      'Fl.R 9M (208°–262°)',
    ])
  })

  it('renders light and hazard popup details', () => {
    const lightHtml = formatMapFeaturePopupHtml({
      layerId: 'osm-seamarks-lights',
      name: 'Start Point',
      kind: 'light',
      osmType: 'node',
      osmId: 123,
      tags: {
        'seamark:type': 'light_minor',
        'seamark:light:character': 'F',
        'seamark:light:colour': 'green',
        'seamark:light:multiple': '2',
        'seamark:light:category': 'vertical',
        'seamark:light:range': '2',
        'seamark:light:reference': 'A 0148',
      },
    })
    expect(lightHtml).toContain('Start Point')
    expect(lightHtml).toContain('Minor light')
    expect(lightHtml).toContain('Characteristic')
    expect(lightHtml).toContain('2F.G(vert)2M')
    expect(lightHtml).toContain('A 0148')
    expect(lightHtml).toContain('View on OpenStreetMap')
    expect(lightHtml).not.toContain('Images')

    const marinaHtml = formatMapFeaturePopupHtml({
      layerId: 'osm-marinas',
      name: 'Royal Victoria',
      kind: 'marina',
      osmType: 'way',
      osmId: 789,
      latitude: 50.8,
      longitude: -1.1,
      tags: {},
    })
    expect(marinaHtml).toContain('View on OpenStreetMap')
    expect(marinaHtml).toContain('Images')
    expect(marinaHtml).toContain('Flickr')
    expect(marinaHtml).toContain('/places/photos?')
    expect(marinaHtml).toContain('source=flickr')
    expect(marinaHtml.indexOf('View on OpenStreetMap')).toBeLessThan(
      marinaHtml.indexOf('Images'),
    )
    expect(marinaHtml.indexOf('Images')).toBeLessThan(marinaHtml.indexOf('Flickr'))

    const hazardHtml = formatMapFeaturePopupHtml({
      layerId: 'osm-seamarks-other',
      name: null,
      kind: 'wreck',
      osmType: 'way',
      osmId: 456,
      tags: {
        historic: 'wreck',
        'seamark:wreck:category': 'non_dangerous',
        depth: '8',
      },
    })
    expect(hazardHtml).toContain('Wreck')
    expect(hazardHtml).toContain('Depth')
    expect(hazardHtml).toContain('8')
  })
})
