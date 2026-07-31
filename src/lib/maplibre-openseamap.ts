import type maplibregl from 'maplibre-gl'
import { getAppOrigin } from './app-origin'

export const OPEN_SEAMAP_SEAMARK_SOURCE_ID = 'openseamap-seamarks'
export const OPEN_SEAMAP_SEAMARK_LAYER_ID = 'openseamap-seamarks'

/** Same-origin proxy recolors dark seamark labels for dark nautical basemaps. */
export function openSeaMapSeamarkTileUrl(variant: 'dark' | 'light' = 'dark'): string {
  const base =
    typeof window === 'undefined' ? 'http://localhost:3020' : getAppOrigin()
  const q = variant === 'light' ? '?variant=light' : ''
  return `${base}/api/openseamap-seamark/{z}/{x}/{y}.png${q}`
}

/** Paint for seamark raster on the dark nautical basemap. */
export const OPEN_SEAMAP_DARK_PAINT = {
  'raster-opacity': 0.95,
} as const

/**
 * Raster seamark overlay on top of the basemap, below app overlays (track, pins).
 * Tiles are transparent PNGs; labels are lightened server-side for dark charts.
 */
export function addOpenSeaMapSeamarkOverlay(map: maplibregl.Map) {
  if (map.getSource(OPEN_SEAMAP_SEAMARK_SOURCE_ID)) return

  map.addSource(OPEN_SEAMAP_SEAMARK_SOURCE_ID, {
    type: 'raster',
    tiles: [openSeaMapSeamarkTileUrl('dark')],
    tileSize: 256,
    minzoom: 0,
    maxzoom: 19,
  })

  map.addLayer({
    id: OPEN_SEAMAP_SEAMARK_LAYER_ID,
    type: 'raster',
    source: OPEN_SEAMAP_SEAMARK_SOURCE_ID,
    minzoom: 8,
    paint: OPEN_SEAMAP_DARK_PAINT,
  })
}
