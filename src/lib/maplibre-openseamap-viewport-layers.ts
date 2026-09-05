import type maplibregl from 'maplibre-gl'
import {
  OPEN_SEAMAP_BATHYMETRY_CONTOURS_LAYER_ID,
  OPEN_SEAMAP_BATHYMETRY_CONTOURS_PAINT,
  OPEN_SEAMAP_BATHYMETRY_CONTOURS_SOURCE_ID,
  openSeaMapBathymetryContoursViewUrl,
} from './maplibre-openseamap-bathymetry'

const EMPTY_IMAGE_COORDINATES: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
]

const CONTOURS_MIN_ZOOM = 6

function isOverlayLayerId(id: string): boolean {
  return id.startsWith('openseamap-') || id.startsWith('geo-') || id.startsWith('trip-') || id.startsWith('route-')
}

/** Insert bathymetry rasters above land/water fills but below labels and roads. */
export function sailingMapRasterInsertBeforeId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle().layers ?? []
  for (const layer of layers) {
    if (isOverlayLayerId(layer.id)) return layer.id
    const lid = layer.id.toLowerCase()
    if (layer.type === 'symbol') return layer.id
    if (layer.type === 'line' && /waterway|road|street|highway|ferry|boundary|label/.test(lid)) {
      return layer.id
    }
  }
  return undefined
}

function ensureContoursImageLayer(map: maplibregl.Map) {
  if (!map.getSource(OPEN_SEAMAP_BATHYMETRY_CONTOURS_SOURCE_ID)) {
    map.addSource(OPEN_SEAMAP_BATHYMETRY_CONTOURS_SOURCE_ID, {
      type: 'image',
      url: '',
      coordinates: EMPTY_IMAGE_COORDINATES,
    })
  }

  if (!map.getLayer(OPEN_SEAMAP_BATHYMETRY_CONTOURS_LAYER_ID)) {
    map.addLayer(
      {
        id: OPEN_SEAMAP_BATHYMETRY_CONTOURS_LAYER_ID,
        type: 'raster',
        source: OPEN_SEAMAP_BATHYMETRY_CONTOURS_SOURCE_ID,
        minzoom: CONTOURS_MIN_ZOOM,
        layout: { visibility: 'none' },
        paint: {
          ...OPEN_SEAMAP_BATHYMETRY_CONTOURS_PAINT,
          'raster-fade-duration': 0,
        },
      },
      sailingMapRasterInsertBeforeId(map),
    )
  }
}

export function ensureOpenSeaMapViewportImageLayers(map: maplibregl.Map) {
  ensureContoursImageLayer(map)
}

export function refreshOpenSeaMapContoursImage(map: maplibregl.Map, visible: boolean) {
  const source = map.getSource(OPEN_SEAMAP_BATHYMETRY_CONTOURS_SOURCE_ID)
  if (!source || source.type !== 'image') return

  const imageSource = source as maplibregl.ImageSource
  if (!visible || map.getZoom() < CONTOURS_MIN_ZOOM) {
    return
  }

  const bounds = map.getBounds()
  const west = bounds.getWest()
  const south = bounds.getSouth()
  const east = bounds.getEast()
  const north = bounds.getNorth()
  const { clientWidth: width, clientHeight: height } = map.getContainer()
  if (width < 64 || height < 64) return

  imageSource.updateImage({
    url: openSeaMapBathymetryContoursViewUrl(west, south, east, north, width, height),
    coordinates: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ],
  })
}

export function bindOpenSeaMapContoursImageRefresh(
  map: maplibregl.Map,
  getVisible: () => boolean,
) {
  let timer: ReturnType<typeof setTimeout> | null = null

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      refreshOpenSeaMapContoursImage(map, getVisible())
    }, 120)
  }

  map.on('moveend', schedule)
  map.on('zoomend', schedule)
  schedule()

  return () => {
    if (timer) clearTimeout(timer)
    map.off('moveend', schedule)
    map.off('zoomend', schedule)
  }
}

/** @deprecated Use ensureOpenSeaMapViewportImageLayers */
export function ensureOpenSeaMapContoursImageLayer(map: maplibregl.Map) {
  ensureOpenSeaMapViewportImageLayers(map)
}

/** @deprecated Use bindOpenSeaMapContoursImageRefresh */
export function bindOpenSeaMapViewportImageRefresh(
  map: maplibregl.Map,
  getVisible: () => boolean,
) {
  return bindOpenSeaMapContoursImageRefresh(map, getVisible)
}

export { OPEN_SEAMAP_BATHYMETRY_CONTOURS_LAYER_ID }
