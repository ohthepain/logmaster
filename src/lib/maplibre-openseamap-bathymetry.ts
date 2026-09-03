import { getAppOrigin } from './app-origin'

export const OPEN_SEAMAP_BATHYMETRY_RELIEF_SOURCE_ID = 'openseamap-bathymetry-relief'
export const OPEN_SEAMAP_BATHYMETRY_RELIEF_LAYER_ID = 'openseamap-bathymetry-relief'
export const OPEN_SEAMAP_BATHYMETRY_CONTOURS_SOURCE_ID = 'openseamap-bathymetry-contours'
export const OPEN_SEAMAP_BATHYMETRY_CONTOURS_LAYER_ID = 'openseamap-bathymetry-contours'

export const OPEN_SEAMAP_BATHYMETRY_RASTER_LAYER_IDS = [
  OPEN_SEAMAP_BATHYMETRY_RELIEF_LAYER_ID,
  OPEN_SEAMAP_BATHYMETRY_CONTOURS_LAYER_ID,
] as const

export const OPEN_SEAMAP_BATHYMETRY_RELIEF_PAINT = {
  'raster-opacity': 0.75,
} as const

export const OPEN_SEAMAP_BATHYMETRY_CONTOURS_PAINT = {
  'raster-opacity': 0.95,
} as const

export function openSeaMapBathymetryReliefTileUrl(): string {
  const base =
    typeof window === 'undefined' ? 'http://localhost:3020' : getAppOrigin()
  return `${base}/api/openseamap-bathymetry/relief/{z}/{x}/{y}.png`
}

function openSeaMapViewportViewUrl(
  path: string,
  west: number,
  south: number,
  east: number,
  north: number,
  width: number,
  height: number,
): string {
  const base =
    typeof window === 'undefined' ? 'http://localhost:3020' : getAppOrigin()
  const params = new URLSearchParams({
    west: String(west),
    south: String(south),
    east: String(east),
    north: String(north),
    width: String(Math.round(width)),
    height: String(Math.round(height)),
  })
  return `${base}/api/openseamap-bathymetry/${path}/view.png?${params}`
}

export function openSeaMapBathymetryContoursViewUrl(
  west: number,
  south: number,
  east: number,
  north: number,
  width: number,
  height: number,
): string {
  return openSeaMapViewportViewUrl('contours', west, south, east, north, width, height)
}
