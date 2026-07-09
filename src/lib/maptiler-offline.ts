/** IndexedDB-backed offline MVT / DEM / glyph / sprite integrations for proxied MapTiler styles */

import type { StyleSpecification } from 'maplibre-gl'

const MAPTILER = 'https://api.maptiler.com'

/** Custom URI schemes resolved in MapLibre (client). */
export const OFF_PROTO = {
  mvt: 'tmvec',
  dem: 'tmdem',
  glyph: 'glyphtm',
  sprite: 'tmsprt',
  /** Legacy PNG basemap offline */
  raster: 'offtm',
} as const

export function mapTilerTerrainRgbTileJsonUrl(): string {
  return `${MAPTILER}/tiles/terrain-rgb/tiles.json`
}

export function mapTilerTerrainRgbTileUrl(
  z: number,
  x: number,
  y: number,
): string {
  return `${MAPTILER}/tiles/terrain-rgb/${z}/${x}/${y}.webp`
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return atob(b64)
}

export function encodeFontstackForGlyphUrl(fontstack: string): string {
  return b64url(fontstack)
}

export function decodeFontstackFromGlyphUrl(part: string): string {
  try {
    return b64urlDecode(part)
  } catch {
    return ''
  }
}

export type VectorSourceDef = {
  id: string
  /** Single `{z}/{x}/{y}` template (MapTiler / TileJSON expanded). */
  tilesTemplate: string
}

async function fetchJsonThroughProxy(
  buildProxyUrl: (maptilerUrl: string) => string,
  urlNoKey: string,
): Promise<unknown> {
  const u = buildProxyUrl(urlNoKey)
  const r = await fetch(u)
  if (!r.ok) throw new Error(`TileJSON fetch ${r.status}: ${urlNoKey}`)
  return r.json() as unknown
}

type TileJSON = { tiles?: string[] }

function firstTileTemplate(tj: TileJSON): string | undefined {
  const t = tj.tiles?.[0]
  return typeof t === 'string' ? t : undefined
}

async function vectorTilesTemplateFromSource(
  buildProxyUrl: (maptilerUrl: string) => string,
  source: Record<string, unknown>,
): Promise<VectorSourceDef | undefined> {
  const id =
    typeof source.id === 'string'
      ? source.id
      : typeof (source as { id?: unknown }).id === 'string'
        ? (source as { id: string }).id
        : ''
  const type = source.type as string | undefined
  if (type !== 'vector' || !id) return undefined

  const tiles = source.tiles
  const url = source.url

  if (Array.isArray(tiles) && typeof tiles[0] === 'string') {
    return { id, tilesTemplate: tiles[0] }
  }
  if (typeof url === 'string') {
    const j = await fetchJsonThroughProxy(buildProxyUrl, url)
    const tj = j as TileJSON
    const tpl = firstTileTemplate(tj)
    if (!tpl) return undefined
    return { id, tilesTemplate: tpl }
  }
  return undefined
}

export async function listVectorTilesTemplates(
  buildProxyUrl: (maptilerUrl: string) => string,
  styleJson: StyleSpecification | Record<string, unknown>,
): Promise<VectorSourceDef[]> {
  const sources = (
    styleJson as { sources?: Record<string, Record<string, unknown>> }
  ).sources
  if (!sources) return []

  const out: VectorSourceDef[] = []

  await Promise.all(
    Object.entries(sources).map(async ([sid, raw]) => {
      const merged =
        typeof raw === 'object'
          ? ({ ...raw, id: sid } as Record<string, unknown>)
          : null
      if (!merged) return
      try {
        const def = await vectorTilesTemplateFromSource(buildProxyUrl, merged)
        if (def) out.push(def)
      } catch {
        /* ignore broken source */
      }
    }),
  )
  return out
}

/** Deep-clone minimal for style mutation. */
export function cloneStyleJson<T>(s: T): T {
  return JSON.parse(JSON.stringify(s)) as T
}

const TRAVELMODE_TERRAIN_SOURCE = 'travelmode-terrain-rgb'

/**
 * If the style has no 3D terrain yet, add MapTiler Terrain-RGB TileJSON as `raster-dem` and enable {@link StyleSpecification.terrain}.
 */
export function ensureTerrainSourceInStyle(
  style: StyleSpecification,
): StyleSpecification {
  const out = cloneStyleJson(style)
  const sources = (
    out as {
      sources?: Record<string, Record<string, unknown>>
    }
  ).sources
  if (!sources) return out

  let demId: string | null = null
  for (const [id, src] of Object.entries(sources)) {
    if (
      typeof src === 'object' &&
      'type' in src &&
      (src as { type?: string }).type === 'raster-dem'
    ) {
      demId = id
      break
    }
  }
  if (!demId) {
    demId = TRAVELMODE_TERRAIN_SOURCE
    sources[demId] = {
      type: 'raster-dem',
      url: mapTilerTerrainRgbTileJsonUrl(),
      tileSize: 256,
    }
  }
  type TerrainSpec = { source: string; exaggeration?: number }
  const terrain = (out as { terrain?: TerrainSpec }).terrain
  if (!terrain) {
    ;(out as { terrain: TerrainSpec }).terrain = {
      source: demId,
      exaggeration: 1.2,
    }
  }
  return out
}

/** Replace MapTiler API URLs so MapLibre can load offline blobs via registered protocols + IndexedDB lookup. */
export function rewriteStyleForOfflineVector(
  mapId: string,
  style: StyleSpecification,
  vectorDefs: readonly VectorSourceDef[],
): StyleSpecification {
  const out = cloneStyleJson(style)

  type Src = Record<string, unknown>

  const defsById = new Map(vectorDefs.map((d) => [d.id, d]))

  const sourcesObj = (out as { sources?: Record<string, Src> }).sources
  if (!sourcesObj) return out

  for (const [sid, raw] of Object.entries(sourcesObj)) {
    if (typeof raw !== 'object') continue
    if (raw.type !== 'vector') continue
    if (!defsById.get(sid)) continue
    const proto = OFF_PROTO.mvt as string
    raw.tiles = [
      `${proto}://${encodeURIComponent(mapId)}/${encodeURIComponent(sid)}/{z}/{x}/{y}`,
    ]
    delete raw.url
    delete raw.bounds
    delete raw.scheme
  }

  /** Terrain DEM source replacement */
  for (const src of Object.values(sourcesObj)) {
    if (typeof src !== 'object') continue
    if (src.type === 'raster-dem') {
      const dem = OFF_PROTO.dem as string
      src.type = 'raster-dem'
      src.tiles = [`${dem}:///{z}/{x}/{y}`]
      src.tileSize = 256
      delete src.url
      delete src.bounds
    }
  }

  /** Glyphs template */
  const g = typeof out.glyphs === 'string' ? out.glyphs : ''
  const glyphScheme = OFF_PROTO.glyph as string
  if (g.includes('maptiler.com/fonts')) {
    ;(out as { glyphs?: string }).glyphs =
      `${glyphScheme}://{fontstack}/{range}`
  }

  /** Sprite PNG + JSON */
  const sprite = typeof out.sprite === 'string' ? out.sprite : ''
  const sprScheme = OFF_PROTO.sprite as string
  if (sprite.length > 0 && !sprite.startsWith(`${sprScheme}:`)) {
    ;(out as { sprite?: string }).sprite =
      `${sprScheme}:/${encodeURIComponent(mapId)}/sprite`
  }

  const exaggerationEarly = ((): number => {
    const terrain = (
      out as {
        terrain?: { exaggeration?: number }
      }
    ).terrain
    if (
      terrain != null &&
      typeof terrain.exaggeration === 'number' &&
      !Number.isNaN(terrain.exaggeration)
    )
      return terrain.exaggeration
    return 1.2
  })()

  const demSid = Object.entries(sourcesObj).find(
    ([, v]) => typeof v === 'object' && v.type === 'raster-dem',
  )?.[0]

  if (demSid != null && demSid.length > 0) {
    ;(
      out as {
        terrain: { source: string; exaggeration: number }
      }
    ).terrain = { source: demSid, exaggeration: exaggerationEarly }
  }

  ;(out as { metadata?: Record<string, string> }).metadata = {
    ...((out as { metadata?: Record<string, string> }).metadata ?? {}),
    travelmodeOffline: 'vector',
    travelmodeMapId: mapId,
  }

  return out
}

/** Replace `{z}` / `{x}` / `{y}` in MapTiler tile URL templates. */
export function applyZxyToTemplate(
  tpl: string,
  z: number,
  x: number,
  y: number,
): string {
  return tpl
    .replace(/\{z\}/g, String(z))
    .replace(/\{x\}/g, String(x))
    .replace(/\{y\}/g, String(y))
}

/** Latin / extended ranges often needed for placenames on navigation maps. */
export const COMMON_GLYPH_RANGES = [
  '0-255',
  '256-511',
  '512-767',
  '7680-7935',
] as const

export function buildGlyphPrefetchUrls(
  fontstacksUsed: Iterable<string>,
  ranges?: readonly string[],
): string[] {
  const rg = ranges ?? COMMON_GLYPH_RANGES
  const urls: string[] = []
  for (const fontstack of fontstacksUsed) {
    const fs = encodeURIComponent(fontstack.trim())
    for (const range of rg) {
      urls.push(`${MAPTILER}/fonts/${fs}/${range}.pbf`)
    }
  }
  return urls
}

/** Inspect symbol layers + style glyphs to guess font stacks (comma-separated). */
export function extractFontStacksFromStyle(styleJson: unknown): Set<string> {
  const stacks = new Set<string>()
  if (!styleJson || typeof styleJson !== 'object') {
    stacks.add('Noto Sans Regular')
    return stacks
  }
  const glyphsField = (styleJson as { glyphs?: unknown }).glyphs
  const glyphs = typeof glyphsField === 'string' ? glyphsField : ''

  /** Default MapTiler / OpenMapTiles bundles */
  if (glyphs.includes('fonts')) {
    stacks.add('Open Sans Italic')
    stacks.add('Open Sans Regular')
    stacks.add('Noto Sans Regular')
    stacks.add('Noto Sans Italic')
    stacks.add('Noto Sans Medium')
    stacks.add('Roboto Medium')
  }

  const layers = (
    styleJson as { layers?: { layout?: Record<string, unknown> }[] }
  ).layers
  if (Array.isArray(layers)) {
    for (const lyr of layers) {
      const layout = lyr.layout
      if (!layout?.['text-field']) continue
      const tf = layout['text-font']
      if (Array.isArray(tf)) {
        for (const item of tf) {
          if (typeof item === 'string') stacks.add(item)
        }
      }
    }
  }

  if (stacks.size === 0) stacks.add('Noto Sans Regular')
  return stacks
}
