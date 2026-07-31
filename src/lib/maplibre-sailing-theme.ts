import type maplibregl from 'maplibre-gl'

/** Dark nautical palette inspired by chart-style sailing apps. */
export const SailingMapColors = {
  background: '#070f18',
  water: '#0c1f33',
  waterway: '#0a1828',
  land: '#1a2830',
  landuse: '#243832',
  landusePark: '#1e3330',
  road: '#6b7785',
  roadMinor: '#4a5560',
  label: '#e8eef4',
  labelSecondary: '#b8c5d0',
  labelHalo: '#070f18',
  track: '#8eb4c8',
  entryFill: '#f1f5f9',
  entryStroke: '#0c1f33',
} as const

function isAppOverlayLayer(id: string): boolean {
  return (
    id.startsWith('trip-') ||
    id.startsWith('compose-') ||
    id.startsWith('geo-') ||
    id.startsWith('openseamap-') ||
    id === 'route'
  )
}

function setPaint(map: maplibregl.Map, layerId: string, prop: string, value: unknown) {
  try {
    if (!map.getLayer(layerId)) return
    map.setPaintProperty(layerId, prop, value)
  } catch {
    /* layer may not support property */
  }
}

function setLayout(map: maplibregl.Map, layerId: string, prop: string, value: unknown) {
  try {
    if (!map.getLayer(layerId)) return
    map.setLayoutProperty(layerId, prop, value)
  } catch {
    /* ignore */
  }
}

function isRoadOrPlaceLabel(id: string): boolean {
  return /road|street|highway|motorway|place|label|name|ref|shield|housenumber|waterway|water|locality|suburb|neighbourhood|hamlet|village|town|city|state|country|island|lake|river|bay|harbour|harbor|marina|canal|strait|channel/.test(
    id,
  )
}

function isPoiClutter(id: string): boolean {
  return /\bpoi\b|mountain|peak|volcano|attraction|museum|zoo|historic|education|commercial|shop|supermarket|mall|restaurant|cafe|bar|pub|fast-food|place-of-worship|town-hall|library|police|fire|post|toilets|viewpoint|picnic|station|airport|heliport|-dot\b|icon-only|shield-dot|marker/.test(
    id,
  )
}

function isHiddenBasemapLayer(id: string): boolean {
  return /building|3d|extrusion|structure|heatmap|hillshade|hillshading|transit|subway|railway|rail-station|rail_station|aerodrome|aeroway-label|airport|runway|taxiway|ferry-route|ferry_route|ferry-line|ferry_line|boundary|admin-/.test(
    id,
  )
}

import { prepareFlatSailingBasemap } from './maplibre-sailing-map-setup'

/**
 * Restyle a MapTiler vector basemap toward a dark nautical / chart look:
 * deep navy water, muted land, thin grey roads, white labels, reduced POI clutter.
 */
export function applySailingLogMapTheme(map: maplibregl.Map) {
  prepareFlatSailingBasemap(map)

  const layers = map.getStyle().layers ?? []

  for (const layer of layers) {
    const id = layer.id
    if (isAppOverlayLayer(id)) continue
    const lid = id.toLowerCase()

    if (layer.type === 'background') {
      setPaint(map, id, 'background-color', SailingMapColors.background)
      continue
    }

    if (layer.type === 'fill') {
      if (/water|ocean|sea|marine|lake|reservoir|pond|basin|wetland|glacier|ice/.test(lid)) {
        setPaint(map, id, 'fill-color', SailingMapColors.water)
        setPaint(map, id, 'fill-opacity', 1)
      } else if (/park|forest|wood|grass|vegetation|cemetery|pitch|garden|scrub|meadow|farmland|orchard|vineyard|green|nature|recreation|golf/.test(lid)) {
        setPaint(map, id, 'fill-color', SailingMapColors.landusePark)
        setPaint(map, id, 'fill-opacity', 0.95)
      } else if (/landuse|landcover|residential|industrial|commercial|retail|school|hospital|stadium|sand|beach|mud|rock|bare|quarry|construction|garages|brownfield/.test(lid)) {
        setPaint(map, id, 'fill-color', SailingMapColors.landuse)
        setPaint(map, id, 'fill-opacity', 0.92)
      } else if (/^land|land-|^country|^state|^urban|^suburb|^neighbourhood|^place-area|^aeroway|^runway|^taxiway|^aero/.test(lid) || lid === 'land') {
        setPaint(map, id, 'fill-color', SailingMapColors.land)
        setPaint(map, id, 'fill-opacity', 1)
      }
      continue
    }

    if (layer.type === 'line') {
      if (/waterway|river|stream|canal|drain|ditch/.test(lid)) {
        setPaint(map, id, 'line-color', SailingMapColors.waterway)
        setPaint(map, id, 'line-opacity', 0.85)
      } else if (/road|street|highway|motorway|trunk|primary|secondary|tertiary|residential|service|path|track|bridge|tunnel|link|contour|border|admin/.test(lid)) {
        const minor = /minor|service|path|track|tertiary|residential|link|contour/.test(lid)
        setPaint(map, id, 'line-color', minor ? SailingMapColors.roadMinor : SailingMapColors.road)
        setPaint(map, id, 'line-opacity', minor ? 0.65 : 0.8)
      }
      continue
    }

    if (layer.type === 'symbol') {
      const layout = layer.layout ?? {}
      const hasText = 'text-field' in layout && layout['text-field'] != null

      if (isPoiClutter(lid) && !isRoadOrPlaceLabel(lid)) {
        setLayout(map, id, 'visibility', 'none')
        continue
      }

      if (hasText) {
        setLayout(map, id, 'visibility', 'visible')
        const secondary = /secondary|tertiary|minor|suburb|neighbourhood|hamlet|locality|state|country|waterway|ref|shield|housenumber|house/.test(lid)
        setPaint(map, id, 'text-color', secondary ? SailingMapColors.labelSecondary : SailingMapColors.label)
        setPaint(map, id, 'text-halo-color', SailingMapColors.labelHalo)
        setPaint(map, id, 'text-halo-width', 1.25)
        setPaint(map, id, 'text-halo-blur', 0.2)
      }
      continue
    }

    if (isHiddenBasemapLayer(lid)) {
      setLayout(map, id, 'visibility', 'none')
    }
  }
}

export const sailingMapOverlayPaint = {
  track: {
    'line-color': SailingMapColors.track,
    'line-width': 2.5,
    'line-opacity': 0.9,
  },
  entry: {
    'circle-radius': 7,
    'circle-color': SailingMapColors.entryFill,
    'circle-stroke-width': 2,
    'circle-stroke-color': SailingMapColors.entryStroke,
  },
} as const
