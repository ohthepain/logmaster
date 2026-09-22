import maplibregl from 'maplibre-gl'
import type { ControlPosition } from 'maplibre-gl'

/** Collapsed MapTiler / OSM attribution (info chip); styled in `.sailing-map` CSS. */
export function addSailingMapAttributionControl(
  map: maplibregl.Map,
  position: ControlPosition = 'bottom-left',
) {
  map.addControl(new maplibregl.AttributionControl({ compact: true }), position)
}
