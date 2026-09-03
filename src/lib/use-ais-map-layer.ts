import maplibregl from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { fetchAisVessels, fetchAisVesselDetails, mapBoundsToAisBbox, aisVesselDetailsToPopupDetails } from './ais-vessels-api'
import {
  bindAisMapLayerPopups,
  clearAisMapLayerData,
  formatAisVesselPopupHtml,
  setAisMapLayerVisibility,
  updateAisMapLayerData,
} from './maplibre-ais-layer'

const POLL_INTERVAL_MS = 12_000
const MOVEEND_DEBOUNCE_MS = 1500

type UseAisMapLayerOptions = {
  enabled: boolean
  online: boolean
  /** False during trip playback — live AIS would mix timelines. */
  allowAis: boolean
  enablePopups?: boolean
}

export function useAisMapLayer(
  mapRef: RefObject<maplibregl.Map | null>,
  mapReady: boolean,
  options: UseAisMapLayerOptions,
) {
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const active = options.enabled && options.online && options.allowAis

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    setAisMapLayerVisibility(map, active)
    if (!active) {
      clearAisMapLayerData(map)
    }
  }, [active, mapReady, mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !active) return

    let cancelled = false
    let moveEndTimer: ReturnType<typeof setTimeout> | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const refresh = async () => {
      const bounds = map.getBounds()
      const result = await fetchAisVessels(mapBoundsToAisBbox(bounds))
      if (cancelled || !result?.configured) {
        if (!cancelled && result && !result.configured) {
          clearAisMapLayerData(map)
        }
        return
      }
      updateAisMapLayerData(map, {
        type: 'FeatureCollection',
        features: result.features,
      })
    }

    const scheduleRefresh = () => {
      if (moveEndTimer) clearTimeout(moveEndTimer)
      moveEndTimer = setTimeout(() => {
        moveEndTimer = null
        void refresh()
      }, MOVEEND_DEBOUNCE_MS)
    }

    void refresh()
    pollTimer = setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
    map.on('moveend', scheduleRefresh)

    return () => {
      cancelled = true
      if (moveEndTimer) clearTimeout(moveEndTimer)
      if (pollTimer) clearInterval(pollTimer)
      map.off('moveend', scheduleRefresh)
    }
  }, [active, mapReady, mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !active || options.enablePopups !== true) return

    return bindAisMapLayerPopups(map, (vessel) => {
      popupRef.current?.remove()
      const popup = new maplibregl.Popup({
        closeButton: true,
        maxWidth: '320px',
        className: 'sailing-map-feature-popup ais-vessel-popup-shell',
        offset: 12,
      })
        .setLngLat(vessel.coordinates)
        .setHTML(formatAisVesselPopupHtml(vessel, undefined, { loading: true }))
        .addTo(map)
      popupRef.current = popup

      void fetchAisVesselDetails(vessel.mmsi).then((details) => {
        if (!popup.isOpen()) return
        popup.setHTML(
          formatAisVesselPopupHtml(
            details?.vessel
              ? {
                  ...vessel,
                  ...details.vessel,
                  coordinates: vessel.coordinates,
                }
              : vessel,
            details ? aisVesselDetailsToPopupDetails(details) : undefined,
          ),
        )
      })
    })
  }, [active, mapReady, mapRef, options.enablePopups])

  useEffect(() => {
    return () => {
      popupRef.current?.remove()
      popupRef.current = null
    }
  }, [])
}
