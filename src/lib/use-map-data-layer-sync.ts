import maplibregl from 'maplibre-gl'
import { useEffect, useMemo, useRef  } from 'react'
import type {RefObject} from 'react';
import { resolveMapDataLayerToggles } from './map-data-layers'
import type { MapDataLayerToggles } from './map-data-layers'
import { formatMapFeaturePopupHtml } from './osm-feature-display'
import {
  applyMapDataLayerToggles,
  bindMapDataLayerPopups,
  bindMapDataLayerRefreshOnViewChange,
  refreshMapDataLayersForViewport,
} from './maplibre-data-layers'
import { bindOpenSeaMapContoursImageRefresh, refreshOpenSeaMapContoursImage } from './maplibre-openseamap-viewport-layers'
import { reloadSeamarkTiles } from './maplibre-sailing-map-setup'
import { syncAisMapLayerForViewport } from './use-ais-map-layer'

export function effectiveMapDataLayerToggles(
  toggles: MapDataLayerToggles,
  options?: { seamarksAllowed?: boolean },
): MapDataLayerToggles {
  const resolved = resolveMapDataLayerToggles(toggles)
  const seamarksAllowed = options?.seamarksAllowed ?? true
  return {
    ...resolved,
    'openseamap-raster': seamarksAllowed && resolved['openseamap-raster'],
  }
}

/** Apply toggles, fetch vector tiles for the current view, and refresh raster overlays. */
export async function syncMapDataLayersForViewport(
  map: maplibregl.Map,
  toggles: MapDataLayerToggles,
) {
  applyMapDataLayerToggles(map, toggles)
  if (toggles['openseamap-raster']) {
    reloadSeamarkTiles(map)
  }
  refreshOpenSeaMapContoursImage(
    map,
    toggles['openseamap-bathymetry-contours'],
  )
  await refreshMapDataLayersForViewport(map, toggles)
}

type MapViewportSyncOptions = {
  seamarksAllowed?: boolean
  /** Fetch live AIS for the current view after other layers settle. */
  ais?: { enabled: boolean; online: boolean }
}

export function scheduleMapDataLayerViewportSync(
  map: maplibregl.Map,
  toggles: MapDataLayerToggles,
  options?: MapViewportSyncOptions,
) {
  map.once('idle', () => {
    const effectiveToggles = effectiveMapDataLayerToggles(toggles, options)
    void (async () => {
      await syncMapDataLayersForViewport(map, effectiveToggles)
      if (options?.ais?.enabled && options.ais.online) {
        await syncAisMapLayerForViewport(map)
      }
    })()
  })
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
    void syncMapDataLayersForViewport(map, effectiveToggles)
  }, [mapRef, mapReady, effectiveToggles])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    return bindOpenSeaMapContoursImageRefresh(
      map,
      () => effectiveTogglesRef.current['openseamap-bathymetry-contours'],
    )
  }, [mapRef, mapReady])

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
          .setHTML(
            formatMapFeaturePopupHtml({
              ...feature,
              latitude: feature.coordinates[1],
              longitude: feature.coordinates[0],
            }),
          )
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
