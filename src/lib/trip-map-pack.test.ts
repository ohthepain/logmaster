import { describe, expect, it, vi } from 'vitest'
import { loadLmmapResource } from './lmmap-protocol'
import {
  canonicalMapResourceUrl,
  glyphResourceUrl,
  lmmapSpriteBase,
  lmmapXyzTemplate,
  resolveLmmapRequest,
  spriteResourceUrls,
} from './lmmap-url'
import { applyZxyToTemplate } from './maptiler-offline'
import { tileRangeForBbox } from './tiles'
import {
  buildPackPlan,
  estimatePackBytes,
  formatByteSize,
  packZoomRange,
  padMapBounds,
} from './trip-map-pack'
import { packIdsAfterAttach, packIdsAfterDetach } from './trip-map-pack-refs'

const harbor = { west: -5.4, south: 36.1, east: -5.2, north: 36.2 }

function tileCount(zMin: number, zMax: number, bounds: typeof harbor): number {
  let count = 0
  for (let zoom = zMin; zoom <= zMax; zoom += 1) {
    count += tileRangeForBbox(
      zoom,
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
    ).length
  }
  return count
}

describe('trip map pack planning', () => {
  it('pads the view and clamps the zoom band', () => {
    expect(padMapBounds({ west: 0, south: 0, east: 10, north: 10 })).toEqual({
      west: -1,
      south: -1,
      east: 11,
      north: 11,
    })
    expect(packZoomRange(12)).toEqual({ zMin: 11, zMax: 14 })
    expect(packZoomRange(15)).toEqual({ zMin: 14, zMax: 16 })
    expect(packZoomRange(0)).toEqual({ zMin: 0, zMax: 2 })
  })

  it('counts chart tiles and skips seamarks below z8 and relief above z11', () => {
    const plan = buildPackPlan({
      bounds: harbor,
      zoom: 12,
      vectorTemplates: ['https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf'],
      seamarkTemplate:
        'http://localhost:3020/api/openseamap-seamark/{z}/{x}/{y}.png',
      reliefTemplate:
        'http://localhost:3020/api/openseamap-bathymetry/relief/{z}/{x}/{y}.png',
      degreeUrls: [
        'http://localhost:3020/api/marinas/N36/W6/v1/tiles/marinas.json.gz',
      ],
      assetUrls: ['http://localhost:3020/api/map-style-vector?map=dataviz-v4'],
    })

    expect(plan.zMin).toBe(11)
    expect(plan.zMax).toBe(14)
    expect(plan.urls).toHaveLength(
      tileCount(11, 14, harbor) * 2 + tileCount(11, 11, harbor) + 2,
    )
    expect(estimatePackBytes(plan.urls.length)).toBeGreaterThan(0)
    expect(formatByteSize(estimatePackBytes(plan.urls.length))).toMatch(/MB|KB/)
  })

  it('omits low-zoom seamarks and high-zoom relief', () => {
    const plan = buildPackPlan({
      bounds: harbor,
      zoom: 6,
      vectorTemplates: [],
      seamarkTemplate:
        'http://localhost:3020/api/openseamap-seamark/{z}/{x}/{y}.png',
      reliefTemplate:
        'http://localhost:3020/api/openseamap-bathymetry/relief/{z}/{x}/{y}.png',
    })

    expect(plan.zMin).toBe(5)
    expect(plan.zMax).toBe(8)
    expect(plan.urls.some((url) => url.includes('openseamap-seamark/5/'))).toBe(
      false,
    )
    expect(plan.urls.some((url) => url.includes('openseamap-seamark/8/'))).toBe(
      true,
    )
    expect(plan.urls.some((url) => url.includes('relief/5/'))).toBe(true)
    expect(plan.urls.some((url) => url.includes('relief/9/'))).toBe(false)
  })

  it('drops a shared tile only after every pack releases it', () => {
    const tiles = new Map<string, string[]>()
    const attach = (key: string, packId: string) => {
      tiles.set(key, packIdsAfterAttach(tiles.get(key), packId))
    }
    const detach = (packId: string, keys: string[]) => {
      for (const key of keys) {
        const next = packIdsAfterDetach(tiles.get(key) ?? [], packId)
        if (next.length === 0) tiles.delete(key)
        else tiles.set(key, next)
      }
    }

    attach('shared', 'pack-a')
    attach('shared', 'pack-b')
    attach('only-a', 'pack-a')
    detach('pack-a', ['shared', 'only-a'])

    expect(tiles.get('shared')).toEqual(['pack-b'])
    expect(tiles.has('only-a')).toBe(false)

    detach('pack-b', ['shared'])
    expect(tiles.size).toBe(0)
  })
})

describe('lmmap resources', () => {
  it('resolves substituted tile urls to the same key the download stores', () => {
    const template = 'https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf'
    const requested = lmmapXyzTemplate(template)
      .replaceAll('{z}', '10')
      .replaceAll('{x}', '500')
      .replaceAll('{y}', '400')

    expect(resolveLmmapRequest(requested)).toBe(
      canonicalMapResourceUrl(applyZxyToTemplate(template, 10, 500, 400)),
    )
  })

  it('resolves glyphs and sprites', () => {
    expect(
      resolveLmmapRequest('lmmap://glyph/Open%20Sans%20Regular/0-255.pbf'),
    ).toBe(glyphResourceUrl('Open Sans Regular', '0-255'))

    const sprite = 'https://api.maptiler.com/maps/dataviz-v4/sprite'
    expect(resolveLmmapRequest(`${lmmapSpriteBase(sprite)}.png`)).toBe(
      spriteResourceUrls(sprite)[1],
    )
  })

  it('reads IndexedDB before the network', async () => {
    const template = 'https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf'
    const requested = lmmapXyzTemplate(template)
      .replaceAll('{z}', '4')
      .replaceAll('{x}', '1')
      .replaceAll('{y}', '2')
    const target = resolveLmmapRequest(requested)
    const stored = new Uint8Array([1, 2, 3]).buffer
    const fetchImpl = vi.fn<typeof fetch>()

    const hit = await loadLmmapResource(requested, {
      readTile: async (key) => (key === target ? stored : undefined),
      fetchImpl,
    })

    expect(new Uint8Array(hit)).toEqual(new Uint8Array([1, 2, 3]))
    expect(fetchImpl).not.toHaveBeenCalled()

    const miss = await loadLmmapResource(requested, {
      readTile: async () => undefined,
      fetchImpl: async () => new Response(new Uint8Array([9])),
    })
    expect(new Uint8Array(miss)).toEqual(new Uint8Array([9]))
  })
})
