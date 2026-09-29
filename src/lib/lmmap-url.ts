/**
 * `lmmap:` URLs let MapLibre substitute `{z}` / `{x}` / `{y}` while the handler
 * reads IndexedDB. `transformRequest` is synchronous, so it cannot do that lookup.
 */

import type { StyleSpecification } from 'maplibre-gl'
import { getAppOrigin } from './app-origin'
import { applyZxyToTemplate } from './maptiler-offline'
import { stripKeyFromMapTilerUrlString } from './maptiler-style-urls'
import { appMaptileCdnQuery } from './tiles'

const LMMAP = 'lmmap:'

function bytesToBinary(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return binary
}

export function lmmapB64url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  return btoa(bytesToBinary(bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function lmmapB64urlDecode(value: string): string {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Same-origin URL used as the IndexedDB key and as the network fetch. */
export function canonicalMapResourceUrl(url: string): string {
  const stripped = stripKeyFromMapTilerUrlString(url)
  if (
    stripped.startsWith('https://api.maptiler.com/') ||
    stripped.startsWith('http://api.maptiler.com/')
  ) {
    return appMaptileCdnQuery(stripped)
  }
  if (stripped.startsWith('/')) {
    const base =
      typeof window === 'undefined' ? 'http://localhost:3020' : getAppOrigin()
    return `${base}${stripped}`
  }
  return stripped
}

export function lmmapXyzTemplate(sourceTemplate: string): string {
  return `lmmap://xyz/{z}/{x}/{y}?k=${lmmapB64url(sourceTemplate)}`
}

export function lmmapGlyphTemplate(): string {
  return 'lmmap://glyph/{fontstack}/{range}.pbf'
}

export function lmmapSpriteBase(spriteUrl: string): string {
  return `lmmap://sprite/${lmmapB64url(stripKeyFromMapTilerUrlString(spriteUrl))}`
}

export function glyphResourceUrl(fontstack: string, range: string): string {
  let decoded = fontstack
  try {
    decoded = decodeURIComponent(fontstack)
  } catch {
    decoded = fontstack
  }
  return canonicalMapResourceUrl(
    `https://api.maptiler.com/fonts/${encodeURIComponent(decoded)}/${range}.pbf`,
  )
}

function withSpriteSuffix(base: string, suffix: string): string {
  const query = base.indexOf('?')
  if (query === -1) return `${base}${suffix}`
  return `${base.slice(0, query)}${suffix}${base.slice(query)}`
}

export function spriteResourceUrls(spriteBase: string): string[] {
  const base = stripKeyFromMapTilerUrlString(spriteBase)
  return ['.json', '.png', '@2x.json', '@2x.png'].map((suffix) =>
    canonicalMapResourceUrl(withSpriteSuffix(base, suffix)),
  )
}

function templateFromLmmapXyz(tileUrl: string): string | null {
  const match = tileUrl.match(/[?&]k=([A-Za-z0-9_-]+)/)
  if (!match?.[1]) return null
  try {
    return lmmapB64urlDecode(match[1])
  } catch {
    return null
  }
}

export type XyzTemplateSource = {
  template: string
  minzoom?: number
  maxzoom?: number
}

function zoomLimit(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Original `{z}/{x}/{y}` templates from a style, including ones already rewritten to lmmap. */
export function xyzTemplatesFromStyle(
  style: StyleSpecification,
): XyzTemplateSource[] {
  const sources = style.sources
  if (!sources) return []
  const templates: XyzTemplateSource[] = []
  for (const source of Object.values(sources)) {
    if (!source || typeof source !== 'object') continue
    const entry = source as {
      tiles?: unknown
      minzoom?: unknown
      maxzoom?: unknown
    }
    const tiles = entry.tiles
    if (!Array.isArray(tiles)) continue
    const minzoom = zoomLimit(entry.minzoom)
    const maxzoom = zoomLimit(entry.maxzoom)
    for (const tile of tiles) {
      if (typeof tile !== 'string' || !tile.includes('{z}')) continue
      const template = tile.startsWith('lmmap://xyz/')
        ? templateFromLmmapXyz(tile)
        : stripKeyFromMapTilerUrlString(tile)
      if (template) templates.push({ template, minzoom, maxzoom })
    }
  }
  return templates
}

export function spriteBaseFromStyle(sprite: string): string | null {
  if (sprite.startsWith('lmmap://sprite/')) {
    const id = sprite.slice('lmmap://sprite/'.length).split(/[.?]/)[0] ?? ''
    if (!id) return null
    try {
      return lmmapB64urlDecode(id)
    } catch {
      return null
    }
  }
  if (sprite.startsWith('http://') || sprite.startsWith('https://')) {
    return stripKeyFromMapTilerUrlString(sprite)
  }
  return null
}

/** Resolve a MapLibre `lmmap:` request to the canonical fetch/storage URL. */
export function resolveLmmapRequest(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== LMMAP) return null

  if (parsed.hostname === 'xyz') {
    const [z, x, y] = parsed.pathname.split('/').filter(Boolean)
    const key = parsed.searchParams.get('k')
    if (!z || !x || !y || !key) return null
    let template: string
    try {
      template = lmmapB64urlDecode(key)
    } catch {
      return null
    }
    const concrete = applyZxyToTemplate(
      template,
      Number(z),
      Number(x),
      Number(y),
    )
    return canonicalMapResourceUrl(concrete)
  }

  if (parsed.hostname === 'glyph') {
    const match = parsed.pathname.match(/^\/(.+)\/([^/]+)\.pbf$/)
    if (!match?.[1] || !match[2]) return null
    return glyphResourceUrl(match[1], match[2])
  }

  if (parsed.hostname === 'sprite') {
    const match = parsed.pathname.match(
      /^\/([A-Za-z0-9_-]+)(@2x)?\.(json|png)$/,
    )
    if (!match?.[1] || !match[3]) return null
    let base: string
    try {
      base = lmmapB64urlDecode(match[1])
    } catch {
      return null
    }
    const suffix = `${match[2] ?? ''}.${match[3]}`
    return canonicalMapResourceUrl(withSpriteSuffix(base, suffix))
  }

  return null
}

type StyleSource = {
  type?: string
  tiles?: string[]
  url?: string
  minzoom?: number
  maxzoom?: number
  bounds?: number[]
}

type TileJsonInfo = {
  template: string
  minzoom?: number
  maxzoom?: number
  bounds?: number[]
}

function cloneStyle(style: StyleSpecification): StyleSpecification {
  return JSON.parse(JSON.stringify(style)) as StyleSpecification
}

async function readTileJson(
  tileJsonUrl: string,
): Promise<TileJsonInfo | undefined> {
  const response = await fetch(canonicalMapResourceUrl(tileJsonUrl))
  if (!response.ok) return undefined
  const json = (await response.json()) as {
    tiles?: unknown
    minzoom?: unknown
    maxzoom?: unknown
    bounds?: unknown
  }
  const tile = Array.isArray(json.tiles) ? json.tiles[0] : undefined
  if (typeof tile !== 'string') return undefined
  const bounds = Array.isArray(json.bounds)
    ? json.bounds.filter((value): value is number => typeof value === 'number')
    : undefined
  return {
    template: stripKeyFromMapTilerUrlString(tile),
    minzoom: zoomLimit(json.minzoom),
    maxzoom: zoomLimit(json.maxzoom),
    bounds: bounds?.length === 4 ? bounds : undefined,
  }
}

/**
 * Point vector tiles, glyphs, and sprites at `lmmap:` so saved bytes are used
 * before the network. TileJSON `url` sources are expanded when the network works.
 */
export async function rewriteStyleToLmmap(
  style: StyleSpecification,
): Promise<StyleSpecification> {
  const out = cloneStyle(style)
  const glyphs = out.glyphs
  if (typeof glyphs === 'string' && glyphs.includes('{fontstack}')) {
    out.glyphs = lmmapGlyphTemplate()
  }
  const sprite = out.sprite
  if (typeof sprite === 'string' && !sprite.startsWith('lmmap:')) {
    out.sprite = lmmapSpriteBase(sprite)
  }

  const sources = out.sources
  if (!sources) return out

  await Promise.all(
    Object.values(sources).map(async (source) => {
      const entry = source as StyleSource
      if (entry.type !== 'vector' && entry.type !== 'raster') return
      if (
        Array.isArray(entry.tiles) &&
        entry.tiles.some((tile) => tile.includes('{z}'))
      ) {
        entry.tiles = entry.tiles.map((tile) =>
          tile.startsWith('lmmap://')
            ? tile
            : lmmapXyzTemplate(stripKeyFromMapTilerUrlString(tile)),
        )
        return
      }
      if (typeof entry.url !== 'string') return
      try {
        const info = await readTileJson(entry.url)
        if (!info?.template.includes('{z}')) return
        entry.tiles = [lmmapXyzTemplate(info.template)]
        if (info.minzoom != null) entry.minzoom = info.minzoom
        if (info.maxzoom != null) entry.maxzoom = info.maxzoom
        if (info.bounds) entry.bounds = info.bounds
        delete entry.url
      } catch {
        /* Keep the TileJSON url so the chart still loads online. */
      }
    }),
  )

  return out
}
