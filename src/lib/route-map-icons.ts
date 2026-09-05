import type maplibregl from 'maplibre-gl'
import {
  drawRouteFinishLine,
  drawRouteStartFlag,
  drawWaypointSquareCross,
  ROUTE_PLANNED_LINE_COLOR,
} from './waypoint-map-style'
import {
  routeMapMarkerImageId,
  ROUTE_MAP_ICON_KINDS,
  type RouteMapIconKind,
} from './route-map-marker'

export const ROUTE_MAP_MARKER_SIZE = 64
export const ROUTE_MAP_MARKER_PIXEL_RATIO = 2

type MarkerSpec = {
  kind: RouteMapIconKind
  color: string
}

const imageDataCache = new Map<string, ImageData>()

function createMarkerCanvas(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create route marker canvas')
  return { canvas, ctx, size }
}

async function renderMarkerImageData(spec: MarkerSpec): Promise<ImageData> {
  const size = ROUTE_MAP_MARKER_SIZE
  const { ctx } = createMarkerCanvas(size)

  switch (spec.kind) {
    case 'waypoint-start':
      drawRouteStartFlag(ctx, size, spec.color)
      break
    case 'waypoint-finish':
      drawRouteFinishLine(ctx, size)
      break
    default:
      drawWaypointSquareCross(ctx, size, spec.color)
      break
  }

  return ctx.getImageData(0, 0, size, size)
}

export async function renderRouteMapMarkerImage(
  kind: RouteMapIconKind,
  color: string,
): Promise<ImageData> {
  const cacheKey = `${kind}:${color}`
  const cached = imageDataCache.get(cacheKey)
  if (cached) return cached
  const image = await renderMarkerImageData({ kind, color })
  imageDataCache.set(cacheKey, image)
  return image
}

function markerSpecsFromGeoJson(collection: {
  features: Array<{ properties?: Record<string, unknown> | null }>
}): MarkerSpec[] {
  const seen = new Set<string>()
  const specs: MarkerSpec[] = []

  for (const feature of collection.features) {
    const properties = feature.properties ?? {}
    const icon = typeof properties.icon === 'string' ? properties.icon : null
    const kind = properties.kind as RouteMapIconKind | undefined
    const color = typeof properties.color === 'string' ? properties.color : null
    if (!icon || !kind || !color) continue
    if (!ROUTE_MAP_ICON_KINDS.includes(kind)) continue
    if (seen.has(icon)) continue
    seen.add(icon)
    specs.push({ kind, color })
  }

  return specs
}

export async function syncRouteMapMarkerImages(
  map: maplibregl.Map,
  collection: { features: Array<{ properties?: Record<string, unknown> | null }> },
) {
  const specs = markerSpecsFromGeoJson(collection)
  await Promise.all(
    specs.map(async (spec) => {
      const imageId = routeMapMarkerImageId(spec.kind, spec.color)
      const image = await renderRouteMapMarkerImage(spec.kind, spec.color)
      if (map.hasImage(imageId)) {
        map.updateImage(imageId, image)
        return
      }
      map.addImage(imageId, image, {
        pixelRatio: ROUTE_MAP_MARKER_PIXEL_RATIO,
      })
    }),
  )
}

export function addRouteWaypointSymbolLayer(
  map: maplibregl.Map,
  sourceId: string,
  layerId: string,
) {
  if (map.getLayer(layerId)) return
  map.addLayer({
    id: layerId,
    type: 'symbol',
    source: sourceId,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': 1,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-anchor': 'center',
    },
  })
}

export const routeLinePaint = {
  'line-color': ROUTE_PLANNED_LINE_COLOR,
  'line-width': 3,
  'line-opacity': 1,
  'line-dasharray': [2, 2.25],
} satisfies maplibregl.LineLayerSpecification['paint']
