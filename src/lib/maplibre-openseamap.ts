import { getAppOrigin } from './app-origin'

/** OpenSeaMap seamark raster overlay (tiles via {@link openSeaMapSeamarkTileUrl}). */
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
