import maplibregl from 'maplibre-gl'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type { MapDataLayerToggles } from './map-data-layers'
import { formatMapFeaturePopupHtml } from './osm-feature-display'
import {
  applyMapDataLayerToggles,
  bindMapDataLayerPopups,
  bindMapDataLayerRefreshOnViewChange,
  refreshMapDataLayersForViewport,
} from './maplibre-data-layers'

export function effectiveMapDataLayerToggles(
  toggles: MapDataLayerToggles,
  options?: { seamarksAllowed?: boolean },
): MapDataLayerToggles {
  const seamarksAllowed = options?.seamarksAllowed ?? true
  return {
    ...toggles,
    'openseamap-raster': seamarksAllowed && toggles['openseamap-raster'],
  }
}

export function useMapDataLayerSync(
  mapRef: RefObject<maplibregl.Map | null>,
  mapReady: boolean,
  toggles: MapDataLayerToggles,
  options?: { enablePopups?: boolean; seamarksAllowed?: boolean },
) {
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const effectiveToggles = useMemo(
    () => effectiveMapDataLayerToggles(toggles, options),
    [toggles, options?.seamarksAllowed],
  )
  const effectiveTogglesRef = useRef(effectiveToggles)
  effectiveTogglesRef.current = effectiveToggles

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    applyMapDataLayerToggles(map, effectiveToggles)
    void refreshMapDataLayersForViewport(map, effectiveToggles)
  }, [mapRef, mapReady, effectiveToggles])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    return bindMapDataLayerRefreshOnViewChange(
      map,
      () => effectiveTogglesRef.current,
    )
  }, [mapRef, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || options?.enablePopups !== true) return

    return bindMapDataLayerPopups(
      map,
      (feature) => {
        popupRef.current?.remove()
        popupRef.current = new maplibregl.Popup({
          closeButton: true,
          maxWidth: '280px',
          className: 'sailing-map-feature-popup',
          offset: 12,
        })
          .setLngLat(feature.coordinates)
          .setHTML(formatMapFeaturePopupHtml(feature))
          .addTo(map)
      },
      () => effectiveTogglesRef.current,
    )
  }, [mapRef, mapReady, options?.enablePopups])

  useEffect(() => {
    return () => {
      popupRef.current?.remove()
      popupRef.current = null
    }
  }, [])
}
