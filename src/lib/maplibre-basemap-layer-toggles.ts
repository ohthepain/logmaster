import type maplibregl from 'maplibre-gl'

/**
 * Rough MapTiler / OpenMapTiles layer ids — toggles visibility for basemap only
 * (route + app geo overlays are skipped by id prefix).
 */
export type MapBasemapLayerToggles = {
  poi: boolean
  building: boolean
  transit: boolean
  landuse: boolean
}

export function defaultMapBasemapLayerToggles(): MapBasemapLayerToggles {
  return { poi: true, building: true, transit: true, landuse: true }
}

/** Guard: keep user route + scraped geo overlays visible. */
function isSkippableAppLayer(id: string): boolean {
  return id === 'route' || id.startsWith('geo-') || id.startsWith('travelmode')
}

/** Heuristic hide by layer id substring (MapTiler vector styles). */
export function applyMapBasemapLayerToggles(
  m: maplibregl.Map,
  t: MapBasemapLayerToggles,
): void {
  const style = m.getStyle?.()
  const layers = style?.layers as { id?: string }[] | undefined
  if (!layers) return

  for (const lyr of layers) {
    const id = lyr.id
    if (typeof id !== 'string' || isSkippableAppLayer(id)) continue

    try {
      if (!m.getLayer?.(id)) continue
      const lid = id.toLowerCase()

      let vis: 'visible' | 'none' | null = null
      if (!t.poi) {
        if (
          /\bpoi\b|place-|place_city|hill|park|historic|education|commercial|grave/.test(
            lid,
          )
        )
          vis = 'none'
      }
      if (!t.building && vis == null && /building/.test(lid)) vis = 'none'
      if (!t.transit && vis == null) {
        if (/\btransit\b|rail|station|ferry|subway/.test(lid)) {
          vis = 'none'
        }
      }
      if (
        !t.landuse &&
        vis == null &&
        /\bland(use|cover)\b|^land-|pattern|vegetation|\bforest\b|^park-/.test(
          lid,
        )
      )
        vis = 'none'

      if (vis != null) m.setLayoutProperty(id, 'visibility', vis)
    } catch {
      /* ignore */
    }
  }
}
