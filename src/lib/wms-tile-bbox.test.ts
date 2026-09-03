import { describe, expect, it } from 'vitest'
import {
  buildWmsGetMapUrl,
  formatWms111Bbox,
  webMercatorBboxForTile,
  webMercatorBboxFromLngLatBounds,
} from './wms-tile-bbox'

describe('webMercatorBboxForTile', () => {
  it('returns world bounds for z0 tile 0/0', () => {
    const bbox = webMercatorBboxForTile(0, 0, 0)
    expect(bbox.minX).toBeCloseTo(-20037508.342789244, 3)
    expect(bbox.maxY).toBeCloseTo(20037508.342789244, 3)
    expect(bbox.maxX - bbox.minX).toBeCloseTo(40075016.68557849, 3)
    expect(bbox.maxY - bbox.minY).toBeCloseTo(40075016.68557849, 3)
  })
})

describe('buildWmsGetMapUrl', () => {
  it('builds a GeoServer WMS GetMap URL', () => {
    const bbox = webMercatorBboxForTile(8, 128, 85)
    const url = buildWmsGetMapUrl('https://example.com/wms', {
      layers: 'gebco2021:gebco_2021',
      bbox,
    })
    expect(url).toContain('SERVICE=WMS')
    expect(url).toContain('REQUEST=GetMap')
    expect(url).toContain('LAYERS=gebco2021%3Agebco_2021')
    expect(url).toContain(`BBOX=${encodeURIComponent(formatWms111Bbox(bbox))}`)
  })

  it('converts lng/lat bounds to Web Mercator', () => {
    const bbox = webMercatorBboxFromLngLatBounds(-5, 49, 2, 52)
    expect(bbox.minX).toBeLessThan(bbox.maxX)
    expect(bbox.minY).toBeLessThan(bbox.maxY)
  })
})
