import type { StyleSpecification } from 'maplibre-gl'
import type maplibregl from 'maplibre-gl'
import type { RasterMapId } from './map-styles'
import {
  ensureVectorStyleGlyphsForMapLibre,
  styleJsonForSailingMap,
} from './maptiler-style-urls'
import { appMapVectorStyleUrl } from './tiles'
import {
  OPEN_SEAMAP_SEAMARK_LAYER_ID,
  OPEN_SEAMAP_SEAMARK_SOURCE_ID,
  openSeaMapSeamarkTileUrl,
  OPEN_SEAMAP_DARK_PAINT,
} from './maplibre-openseamap'
import { ensureMapDataLayerStackOrder } from './maplibre-data-layers'

const HILLSHADE_LAYER_ID = 'Hillshade'

/** Fetch + sanitize style so MapLibre never enables 3D terrain (even from stale caches). */
export async function loadSailingMapStyle(
  mapId: RasterMapId,
): Promise<StyleSpecification> {
  const res = await fetch(appMapVectorStyleUrl(mapId), { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Map style failed (${res.status})`)
  }
  const json: unknown = await res.json()
  const style = styleJsonForSailingMap(json) as StyleSpecification
  ensureVectorStyleGlyphsForMapLibre(style)
  return style
}

/** Block terrain re-enable after style loads; terrain draping clips raster tiles (MapLibre #1559). */
export function guardSailingMapAgainstTerrain(map: maplibregl.Map) {
  const nativeSetTerrain = map.setTerrain.bind(map)
  map.setTerrain = ((options: maplibregl.TerrainSpecification | null) => {
    if (options != null) return map
    return nativeSetTerrain(null)
  }) as typeof map.setTerrain

  const flatten = () => prepareFlatSailingBasemap(map)
  const onStyleData = (event: maplibregl.MapDataEvent) => {
    if (event.dataType === 'style') flatten()
  }

  map.on('style.load', flatten)
  map.on('data', onStyleData)
  flatten()

  return () => {
    map.off('style.load', flatten)
    map.off('data', onStyleData)
  }
}

/** Terrain draping clips raster seamarks unevenly across the viewport (MapLibre #1559). */
export function prepareFlatSailingBasemap(map: maplibregl.Map) {
  try {
    if (map.getTerrain()) {
      map.setTerrain(null)
    }
  } catch {
    /* map not ready */
  }

  try {
    if (map.getLayer(HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(HILLSHADE_LAYER_ID, 'visibility', 'none')
    }
  } catch {
    /* hillshade already removed from style */
  }

  try {
    if (map.getPitch() !== 0) {
      map.setPitch(0)
    }
  } catch {
    /* ignore */
  }
}

function isSeamarkLayerOnTop(map: maplibregl.Map): boolean {
  const layers = map.getStyle().layers ?? []
  return layers.at(-1)?.id === OPEN_SEAMAP_SEAMARK_LAYER_ID
}

/** Keep OpenSeaMap above every basemap layer (labels, fills, hillshade). */
export function ensureSeamarkLayerOnTop(map: maplibregl.Map) {
  if (!map.getLayer(OPEN_SEAMAP_SEAMARK_LAYER_ID)) return
  if (isSeamarkLayerOnTop(map)) return

  try {
    map.moveLayer(OPEN_SEAMAP_SEAMARK_LAYER_ID)
  } catch {
    /* layer order already correct or map unloading */
  }
}

export function reloadSeamarkTiles(map: maplibregl.Map) {
  const source = map.getSource(OPEN_SEAMAP_SEAMARK_SOURCE_ID)
  if (source && 'reload' in source && typeof source.reload === 'function') {
    source.reload()
  }
}

export function addOpenSeaMapSeamarkOverlay(map: maplibregl.Map) {
  if (!map.getSource(OPEN_SEAMAP_SEAMARK_SOURCE_ID)) {
    map.addSource(OPEN_SEAMAP_SEAMARK_SOURCE_ID, {
      type: 'raster',
      tiles: [openSeaMapSeamarkTileUrl('dark')],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 18,
      scheme: 'xyz',
    })
  }

  if (!map.getLayer(OPEN_SEAMAP_SEAMARK_LAYER_ID)) {
    map.addLayer({
      id: OPEN_SEAMAP_SEAMARK_LAYER_ID,
      type: 'raster',
      source: OPEN_SEAMAP_SEAMARK_SOURCE_ID,
      minzoom: 8,
      paint: {
        ...OPEN_SEAMAP_DARK_PAINT,
        'raster-fade-duration': 0,
        'raster-resampling': 'linear',
      },
    })
  }

  ensureMapDataLayerStackOrder(map)
}

export function finalizeSailingMapLayers(map: maplibregl.Map) {
  prepareFlatSailingBasemap(map)
  ensureMapDataLayerStackOrder(map)
  reloadSeamarkTiles(map)
  try {
    map.resize()
  } catch {
    /* ignore */
  }
}

/** One-shot tile refresh after pan/zoom settles — avoids per-idle moveLayer thrashing. */
export function scheduleSeamarkTileRefresh(map: maplibregl.Map) {
  map.once('idle', () => {
    ensureMapDataLayerStackOrder(map)
    reloadSeamarkTiles(map)
  })
}

/** Refresh seamark tiles after the view changes (fixes missing tile squares at some zooms). */
export function bindSeamarkTileRefreshOnViewChange(map: maplibregl.Map) {
  const refresh = () => scheduleSeamarkTileRefresh(map)
  map.on('zoomend', refresh)
  map.on('moveend', refresh)
  return () => {
    map.off('zoomend', refresh)
    map.off('moveend', refresh)
  }
}
