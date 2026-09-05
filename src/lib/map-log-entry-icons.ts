import type { FeatureCollection } from 'geojson'
import type maplibregl from 'maplibre-gl'
import { SailingMapColors, sailingMapLegEntryIconLayout } from './maplibre-sailing-theme'
import type {
  LogEntryMapIconKind,
  LogEntryMapOutline,
} from './log-entry-map-marker'
import {
  LOG_ENTRY_MAP_ICON_KINDS,
  logEntryMapMarkerImageId,
} from './log-entry-map-marker'

export const LOG_ENTRY_MAP_MARKER_SIZE = 64
export const LOG_ENTRY_MAP_MEDIA_MARKER_SIZE = 46
export const LOG_ENTRY_MAP_MARKER_PIXEL_RATIO = 2
export const LOG_ENTRY_MAP_SELECTED_ICON_SCALE = 1.35

function isMediaMarkerKind(kind: LogEntryMapIconKind): boolean {
  return kind === 'media-photo' || kind === 'media-video'
}

function markerCanvasSize(kind: LogEntryMapIconKind): number {
  return isMediaMarkerKind(kind)
    ? LOG_ENTRY_MAP_MEDIA_MARKER_SIZE
    : LOG_ENTRY_MAP_MARKER_SIZE
}

const GLYPH_ASSETS: Partial<Record<LogEntryMapIconKind, string>> = {
  'anchor-dropped': '/buttons/anchor-down-white.png',
  'anchor-weighed': '/buttons/anchor-up-white.png',
  moored: '/buttons/moored-white.png',
  unmoored: '/buttons/unmoored-white.png',
  'sails-up': '/buttons/sails-up-v2.png',
  'sails-down': '/buttons/sails-down-v2.png',
  'engine-on': '/buttons/engine-on-white.png',
  'engine-off': '/buttons/engine-off-white.png',
}

const imageDataCache = new Map<string, ImageData>()
const dataUrlCache = new Map<string, string>()
const glyphImageCache = new Map<string, HTMLImageElement | null>()
const glyphLoaders = new Map<string, Promise<HTMLImageElement | null>>()

type MarkerSpec = {
  kind: LogEntryMapIconKind
  color: string
  outline: LogEntryMapOutline
}

function parseHexColor(color: string): { r: number; g: number; b: number } {
  const hex = color.trim().replace('#', '')
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((part) => part + part)
          .join('')
      : hex
  const value = Number.parseInt(normalized.slice(0, 6), 16)
  if (!Number.isFinite(value)) {
    return { r: 37, g: 96, b: 138 }
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function createMarkerCanvas(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create log entry marker canvas')
  return { canvas, ctx, size }
}

const MARKER_GLYPH_COLOR = SailingMapColors.labelHalo

function markerCircleGeometry(size: number) {
  const center = size / 2
  return { center, radius: center - 5, strokeWidth: 4.5 }
}

function mediaRectGeometry(size: number) {
  const width = size - 8
  const height = size - 14
  const x = (size - width) / 2
  const y = (size - height) / 2
  return { x, y, width, height, radius: 4.5, strokeWidth: 3.5 }
}

function fillMarkerCircle(ctx: CanvasRenderingContext2D, size: number) {
  const { center, radius } = markerCircleGeometry(size)
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.fillStyle = SailingMapColors.entryFill
  ctx.fill()
}

function fillMediaRect(ctx: CanvasRenderingContext2D, size: number) {
  const { x, y, width, height, radius } = mediaRectGeometry(size)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
  ctx.fillStyle = SailingMapColors.entryFill
  ctx.fill()
}

function strokeMarkerCircle(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  outline: LogEntryMapOutline,
) {
  const { center, radius, strokeWidth } = markerCircleGeometry(size)
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.setLineDash(outline === 'dotted' ? [0.8, 5.2] : [])
  ctx.stroke()
  ctx.setLineDash([])
}

function strokeMediaRect(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  outline: LogEntryMapOutline,
) {
  const { x, y, width, height, radius, strokeWidth } = mediaRectGeometry(size)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
  ctx.strokeStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.setLineDash(outline === 'dotted' ? [0.8, 4.8] : [])
  ctx.stroke()
  ctx.setLineDash([])
}

function clipToInnerCircle(ctx: CanvasRenderingContext2D, size: number) {
  const { center, radius, strokeWidth } = markerCircleGeometry(size)
  ctx.beginPath()
  ctx.arc(center, center, radius - strokeWidth, 0, Math.PI * 2)
  ctx.clip()
}

function clipToInnerMediaRect(ctx: CanvasRenderingContext2D, size: number) {
  const { x, y, width, height, radius, strokeWidth } = mediaRectGeometry(size)
  const inset = strokeWidth
  ctx.beginPath()
  ctx.moveTo(x + inset + radius, y + inset)
  ctx.arcTo(
    x + width - inset,
    y + inset,
    x + width - inset,
    y + height - inset,
    radius,
  )
  ctx.arcTo(
    x + width - inset,
    y + height - inset,
    x + inset,
    y + height - inset,
    radius,
  )
  ctx.arcTo(x + inset, y + height - inset, x + inset, y + inset, radius)
  ctx.arcTo(x + inset, y + inset, x + width - inset, y + inset, radius)
  ctx.closePath()
  ctx.clip()
}

function withGlyphFrame(
  ctx: CanvasRenderingContext2D,
  color: string,
  canvasSize: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const inset = canvasSize <= LOG_ENTRY_MAP_MEDIA_MARKER_SIZE ? 11 : 16
  const scale = (canvasSize - inset * 2) / 24
  ctx.save()
  ctx.translate(inset, inset)
  ctx.scale(scale, scale)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.85
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  draw(ctx)
  ctx.restore()
}

function drawFallbackGlyph(
  ctx: CanvasRenderingContext2D,
  kind: LogEntryMapIconKind,
  color: string,
  canvasSize: number,
) {
  withGlyphFrame(ctx, color, canvasSize, (glyph) => {
    switch (kind) {
      case 'anchor-dropped':
        drawAnchorGlyph(glyph, 'down')
        break
      case 'anchor-weighed':
        drawAnchorGlyph(glyph, 'up')
        break
      case 'moored':
        drawMooredGlyph(glyph, true)
        break
      case 'unmoored':
        drawMooredGlyph(glyph, false)
        break
      case 'sails-up':
        drawSailsUpGlyph(glyph)
        break
      case 'sails-down':
        drawSailsDownGlyph(glyph)
        break
      case 'engine-on':
        drawEngineGlyph(glyph, true)
        break
      case 'engine-off':
        drawEngineGlyph(glyph, false)
        break
      case 'video':
      case 'media-video':
        drawVideoGlyph(glyph)
        break
      case 'photo':
      case 'media-photo':
        drawPhotoGlyph(glyph)
        break
      case 'voice':
        drawVoiceGlyph(glyph)
        break
      case 'note':
        drawNoteGlyph(glyph)
        break
      case 'hourly-log':
        drawClockGlyph(glyph)
        break
      case 'direction-change':
        drawCompassGlyph(glyph)
        break
      case 'start-trip':
        drawStartTripGlyph(glyph)
        break
      case 'end-trip':
        drawEndTripGlyph(glyph)
        break
    }
  })
}

function drawAnchorGlyph(ctx: CanvasRenderingContext2D, direction: 'up' | 'down') {
  ctx.beginPath()
  ctx.arc(12, 4.2, 1.6, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(12, 5.8)
  ctx.lineTo(12, 16.5)
  ctx.moveTo(8.2, 8.4)
  ctx.lineTo(15.8, 8.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(12, 16.2, 5.2, Math.PI * 0.12, Math.PI - Math.PI * 0.12)
  ctx.stroke()
  ctx.beginPath()
  if (direction === 'down') {
    ctx.moveTo(12, 14.2)
    ctx.lineTo(12, 20.6)
    ctx.moveTo(9.6, 18.4)
    ctx.lineTo(12, 20.8)
    ctx.lineTo(14.4, 18.4)
  } else {
    ctx.moveTo(12, 20.4)
    ctx.lineTo(12, 14)
    ctx.moveTo(9.6, 16.2)
    ctx.lineTo(12, 13.8)
    ctx.lineTo(14.4, 16.2)
  }
  ctx.stroke()
}

function drawMooredGlyph(ctx: CanvasRenderingContext2D, moored: boolean) {
  ctx.beginPath()
  ctx.moveTo(6.4, 11.2)
  ctx.lineTo(17.6, 11.2)
  ctx.moveTo(12, 11.2)
  ctx.lineTo(12, 6.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(8.4, 6.4)
  ctx.lineTo(15.6, 6.4)
  ctx.lineTo(15.6, 4.8)
  ctx.quadraticCurveTo(12, 3.4, 8.4, 4.8)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(5.2, 14.8)
  ctx.quadraticCurveTo(8, 12.8, 12, 14.8)
  ctx.quadraticCurveTo(16, 16.8, 18.8, 14.8)
  ctx.stroke()
  if (moored) {
    ctx.beginPath()
    ctx.moveTo(4.8, 9.6)
    ctx.quadraticCurveTo(9.5, 8.2, 12, 10.4)
    ctx.quadraticCurveTo(14.2, 12.2, 12.4, 13.4)
    ctx.stroke()
  }
}

function drawSailsUpGlyph(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(16.4, 3.4)
  ctx.lineTo(16.4, 20.6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(16.4, 4.6)
  ctx.lineTo(6.2, 19.4)
  ctx.lineTo(16.4, 19.4)
  ctx.closePath()
  ctx.stroke()
}

function drawSailsDownGlyph(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(16.4, 3.6)
  ctx.lineTo(16.4, 20.4)
  ctx.moveTo(6.4, 19.2)
  ctx.lineTo(16.4, 19.2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(11.4, 16.6, 5, 2.1, 0, 0, Math.PI * 2)
  ctx.stroke()
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
  ctx.stroke()
}

function drawEngineGlyph(ctx: CanvasRenderingContext2D, running: boolean) {
  strokeRoundRect(ctx, 6.4, 9.4, 11.4, 7.4, 1.4)
  ctx.beginPath()
  ctx.moveTo(6.4, 12)
  ctx.lineTo(4.2, 12)
  ctx.lineTo(4.2, 15.8)
  ctx.lineTo(6.4, 15.8)
  ctx.moveTo(17.8, 11.4)
  ctx.lineTo(19.6, 11.4)
  ctx.lineTo(19.6, 16.4)
  ctx.lineTo(17.8, 16.4)
  ctx.stroke()
  if (running) {
    ctx.beginPath()
    ctx.arc(9.4, 6.6, 2.1, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(14.8, 6.6, 2.1, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
  }
}

function drawPhotoGlyph(ctx: CanvasRenderingContext2D) {
  strokeRoundRect(ctx, 3.6, 8.2, 16.8, 11.2, 1.8)
  ctx.beginPath()
  ctx.moveTo(8.4, 8.2)
  ctx.lineTo(9.6, 5.6)
  ctx.lineTo(14.4, 5.6)
  ctx.lineTo(15.6, 8.2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(12, 13.6, 3.1, 0, Math.PI * 2)
  ctx.stroke()
}

function drawVideoGlyph(ctx: CanvasRenderingContext2D) {
  strokeRoundRect(ctx, 3.4, 7.6, 12.4, 9.2, 1.6)
  ctx.beginPath()
  ctx.moveTo(15.8, 10.2)
  ctx.lineTo(20.6, 7.8)
  ctx.lineTo(20.6, 16.6)
  ctx.lineTo(15.8, 14.2)
  ctx.closePath()
  ctx.stroke()
}

function drawVoiceGlyph(ctx: CanvasRenderingContext2D) {
  strokeRoundRect(ctx, 9.2, 3.8, 5.6, 9.2, 2.8)
  ctx.beginPath()
  ctx.arc(12, 13, 5.2, Math.PI * 0.08, Math.PI - Math.PI * 0.08)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(12, 18.2)
  ctx.lineTo(12, 20.6)
  ctx.moveTo(8.8, 20.6)
  ctx.lineTo(15.2, 20.6)
  ctx.stroke()
}

function drawNoteGlyph(ctx: CanvasRenderingContext2D) {
  strokeRoundRect(ctx, 5.4, 3.8, 13.2, 16.6, 1.6)
  ctx.beginPath()
  ctx.moveTo(8.2, 8.4)
  ctx.lineTo(15.8, 8.4)
  ctx.moveTo(8.2, 12)
  ctx.lineTo(15.8, 12)
  ctx.moveTo(8.2, 15.6)
  ctx.lineTo(13.2, 15.6)
  ctx.stroke()
}

function drawClockGlyph(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.arc(12, 12, 8.2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(12, 12)
  ctx.lineTo(12, 7.4)
  ctx.moveTo(12, 12)
  ctx.lineTo(16.2, 13.6)
  ctx.stroke()
}

function drawCompassGlyph(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.arc(12, 12, 8.2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(12, 5.2)
  ctx.lineTo(14.4, 12)
  ctx.lineTo(12, 18.8)
  ctx.lineTo(9.6, 12)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(12, 5.2)
  ctx.lineTo(12, 12)
  ctx.lineTo(14.4, 12)
  ctx.closePath()
  ctx.fill()
}

function drawStartTripGlyph(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(7.2, 4.2)
  ctx.lineTo(7.2, 20.6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(7.2, 4.4)
  ctx.lineTo(18.6, 8.2)
  ctx.lineTo(7.2, 12)
  ctx.closePath()
  ctx.stroke()
}

function drawEndTripGlyph(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(7.2, 4.2)
  ctx.lineTo(7.2, 20.6)
  ctx.stroke()
  ctx.fillRect(7.4, 4.6, 4.2, 3.4)
  ctx.strokeRect(11.6, 4.6, 4.2, 3.4)
  ctx.strokeRect(7.4, 8, 4.2, 3.4)
  ctx.fillRect(11.6, 8, 4.2, 3.4)
}

function colorizeGlyphImage(
  image: HTMLImageElement,
  color: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { r, g, b } = parseHexColor(color)
  const data = pixels.data
  for (let i = 0; i < data.length; i += 4) {
    const red = data[i]
    const green = data[i + 1]
    const blue = data[i + 2]
    if (red < 18 && green < 18 && blue < 18) {
      data[i + 3] = 0
      continue
    }
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}

function loadGlyphImage(src: string): Promise<HTMLImageElement | null> {
  const cached = glyphImageCache.get(src)
  if (cached !== undefined) return Promise.resolve(cached)
  const pending = glyphLoaders.get(src)
  if (pending) return pending

  const loader = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      glyphImageCache.set(src, image)
      resolve(image)
    }
    image.onerror = () => {
      glyphImageCache.set(src, null)
      resolve(null)
    }
    image.src = src
  }).finally(() => {
    glyphLoaders.delete(src)
  })

  glyphLoaders.set(src, loader)
  return loader
}

function drawGlyphFromAsset(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  color: string,
  canvasSize: number,
) {
  const tinted = colorizeGlyphImage(image, color)
  const inset = canvasSize <= LOG_ENTRY_MAP_MEDIA_MARKER_SIZE ? 10 : 13
  const size = canvasSize - inset * 2
  ctx.drawImage(tinted, inset, inset, size, size)
}

export function logEntryMapMarkerDisplaySize(kind: LogEntryMapIconKind): number {
  const canvasSize = isMediaMarkerKind(kind)
    ? LOG_ENTRY_MAP_MEDIA_MARKER_SIZE
    : LOG_ENTRY_MAP_MARKER_SIZE
  return canvasSize / LOG_ENTRY_MAP_MARKER_PIXEL_RATIO
}

async function renderMarkerImageData(spec: MarkerSpec): Promise<ImageData> {
  const size = markerCanvasSize(spec.kind)
  const { ctx } = createMarkerCanvas(size)
  const mediaMarker = isMediaMarkerKind(spec.kind)

  if (mediaMarker) {
    fillMediaRect(ctx, size)
  } else {
    fillMarkerCircle(ctx, size)
  }

  ctx.save()
  if (mediaMarker) {
    clipToInnerMediaRect(ctx, size)
  } else {
    clipToInnerCircle(ctx, size)
  }

  const asset = GLYPH_ASSETS[spec.kind]
  const image = asset ? await loadGlyphImage(asset) : null
  if (image) {
    drawGlyphFromAsset(ctx, image, MARKER_GLYPH_COLOR, size)
  } else {
    drawFallbackGlyph(ctx, spec.kind, MARKER_GLYPH_COLOR, size)
  }
  ctx.restore()

  if (mediaMarker) {
    strokeMediaRect(ctx, size, spec.color, spec.outline)
  } else {
    strokeMarkerCircle(ctx, size, spec.color, spec.outline)
  }

  return ctx.getImageData(0, 0, size, size)
}

export async function renderLogEntryMapMarkerImage(
  kind: LogEntryMapIconKind,
  color: string,
  outline: LogEntryMapOutline,
): Promise<ImageData> {
  const cacheKey = `${kind}:${color}:${outline}`
  const cached = imageDataCache.get(cacheKey)
  if (cached) return cached
  const image = await renderMarkerImageData({ kind, color, outline })
  imageDataCache.set(cacheKey, image)
  return image
}

export async function renderLogEntryMapMarkerDataUrl(
  kind: LogEntryMapIconKind,
  color: string,
  outline: LogEntryMapOutline,
): Promise<string> {
  const cacheKey = `${kind}:${color}:${outline}`
  const cached = dataUrlCache.get(cacheKey)
  if (cached) return cached

  const image = await renderLogEntryMapMarkerImage(kind, color, outline)
  const size = markerCanvasSize(kind)
  const { canvas, ctx } = createMarkerCanvas(size)
  ctx.putImageData(image, 0, 0)
  const dataUrl = canvas.toDataURL('image/png')
  dataUrlCache.set(cacheKey, dataUrl)
  return dataUrl
}

export function addLogEntrySymbolLayer(
  map: maplibregl.Map,
  sourceId: string,
  layerId: string,
  selectedEntryId: string | null = null,
) {
  if (map.getLayer(layerId)) return
  map.addLayer({
    id: layerId,
    type: 'symbol',
    source: sourceId,
    layout: {
      ...sailingMapLegEntryIconLayout,
      'icon-size': logEntryMapIconSizeExpression(selectedEntryId),
    },
  })
}

export function logEntryMapIconSizeExpression(
  selectedEntryId: string | null,
): maplibregl.ExpressionSpecification | number {
  if (!selectedEntryId) return 1
  return [
    'case',
    ['==', ['get', 'entryId'], selectedEntryId],
    LOG_ENTRY_MAP_SELECTED_ICON_SCALE,
    1,
  ]
}

export function syncLogEntryMapIconSelection(
  map: maplibregl.Map,
  layerId: string,
  selectedEntryId: string | null,
) {
  if (!map.getLayer(layerId)) return
  map.setLayoutProperty(layerId, 'icon-size', logEntryMapIconSizeExpression(selectedEntryId))
}

function markerSpecsFromGeoJson(
  collection: FeatureCollection,
): MarkerSpec[] {
  const seen = new Set<string>()
  const specs: MarkerSpec[] = []

  for (const feature of collection.features) {
    const properties = feature.properties ?? {}
    const icon = typeof properties.icon === 'string' ? properties.icon : null
    const kind = properties.kind as LogEntryMapIconKind | undefined
    const color = typeof properties.color === 'string' ? properties.color : null
    const outline = properties.outline as LogEntryMapOutline | undefined
    if (!icon || !kind || !color || !outline) continue
    if (!LOG_ENTRY_MAP_ICON_KINDS.includes(kind)) continue
    if (seen.has(icon)) continue
    seen.add(icon)
    specs.push({ kind, color, outline })
  }

  return specs
}

export async function syncLogEntryMapMarkerImages(
  map: maplibregl.Map,
  collection: FeatureCollection,
) {
  const specs = markerSpecsFromGeoJson(collection)
  await Promise.all(
    specs.map(async (spec) => {
      const imageId = logEntryMapMarkerImageId(spec.kind, spec.color, spec.outline)
      const image = await renderLogEntryMapMarkerImage(
        spec.kind,
        spec.color,
        spec.outline,
      )
      if (map.hasImage(imageId)) {
        map.updateImage(imageId, image)
        return
      }
      map.addImage(imageId, image, {
        pixelRatio: LOG_ENTRY_MAP_MARKER_PIXEL_RATIO,
      })
    }),
  )
}
