import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DEV_FALLBACK_POSITION } from '../lib/logbook-context'
import type { MapLngLat } from '../lib/logbook-map-geo'
import { isValidMapLngLat, mapBrandColor } from '../lib/logbook-map-geo'
import {
  addOpenSeaMapSeamarkOverlay,
  addOpenSeaMapBathymetryOverlays,
  bindSeamarkTileRefreshOnViewChange,
  finalizeSailingMapLayers,
  guardSailingMapAgainstTerrain,
  loadSailingMapStyle,
  scheduleSeamarkTileRefresh,
} from '../lib/maplibre-sailing-map-setup'
import { applySailingLogMapTheme, SailingMapColors } from '../lib/maplibre-sailing-theme'
import { queryTappableMapDataFeatures } from '../lib/maplibre-data-layers'
import { defaultRasterMapId } from '../lib/map-styles'
import { installMapDataLayers } from '../lib/maplibre-data-layers'
import {
  centerMapOnCurrentLocation,
  centerMapOnPoint,
  juiceMapFocus,
  SAILING_MAP_FOCUS_ZOOM,
  SAILING_MAP_LOCATE_ZOOM,
} from '../lib/sailing-map-viewport'
import { mapTilerTransformRequest } from '../lib/tiles'
import { useMapDataLayerSync } from '../lib/use-map-data-layer-sync'
import { cn } from '../lib/cn'
import { useAppOptionsStore } from '../stores/app-options'
import { DevComponentLabel } from './DevComponentLabel'
import { SailingMapControlStack } from './SailingMapControlStack'
import { SailingMapFullscreenModal } from './SailingMapFullscreenModal'
import { SailingMapLayerPanel } from './SailingMapLayerPanel'

type WaypointPositionEditorProps = {
  position: MapLngLat | null
  onPositionChange: (position: MapLngLat) => void
  mapClassName?: string
  allowFullscreen?: boolean
  hint?: string
}

const DRAFT_MARKER_ID = 'waypoint-draft-marker'

export function WaypointPositionEditor({
  position,
  onPositionChange,
  mapClassName = 'h-56 w-full sm:h-64',
  allowFullscreen = true,
  hint = 'Drag pin or tap map to adjust',
}: WaypointPositionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onPositionChangeRef = useRef(onPositionChange)
  const initialFitDoneRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const mapDataLayerToggles = useAppOptionsStore((state) => state.mapDataLayerToggles)
  const setMapDataLayerToggles = useAppOptionsStore((state) => state.setMapDataLayerToggles)

  useMapDataLayerSync(mapRef, mapReady, mapDataLayerToggles, {
    enablePopups: true,
  })

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange
  }, [onPositionChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    let cancelled = false
    let unbindTerrainGuard: (() => void) | undefined
    let unbindSeamarkRefresh: (() => void) | undefined
    let map: maplibregl.Map | null = null

    void loadSailingMapStyle(defaultRasterMapId())
      .then((style) => {
        if (cancelled || mapRef.current) return

        map = new maplibregl.Map({
          container,
          style,
          center: [DEV_FALLBACK_POSITION.longitude, DEV_FALLBACK_POSITION.latitude],
          zoom: 10,
          pitch: 0,
          maxPitch: 0,
          attributionControl: false,
          transformRequest: (url) => mapTilerTransformRequest(url),
        })

        unbindTerrainGuard = guardSailingMapAgainstTerrain(map)
        map.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          'bottom-right',
        )

        map.on('load', () => {
          if (!map) return
          applySailingLogMapTheme(map)
          addOpenSeaMapSeamarkOverlay(map)
          addOpenSeaMapBathymetryOverlays(map)
          installMapDataLayers(map)

          const marker = new maplibregl.Marker({
            element: createDraftMarkerElement(),
            draggable: true,
            anchor: 'center',
          })
          marker.on('dragend', () => {
            const lngLat = marker.getLngLat()
            if (!lngLat) return
            onPositionChangeRef.current({
              longitude: lngLat.lng,
              latitude: lngLat.lat,
            })
          })
          markerRef.current = marker

          map.on('click', (event) => {
            if (!event.lngLat) return
            const hits = queryTappableMapDataFeatures(
              map!,
              event.point,
              useAppOptionsStore.getState().mapDataLayerToggles,
            )
            if (hits.length > 0) return
            marker.setLngLat(event.lngLat)
            if (!marker.getElement().isConnected) {
              marker.addTo(map!)
            }
            onPositionChangeRef.current({
              longitude: event.lngLat.lng,
              latitude: event.lngLat.lat,
            })
          })

          finalizeSailingMapLayers(map)
          scheduleSeamarkTileRefresh(map)
          unbindSeamarkRefresh = bindSeamarkTileRefreshOnViewChange(map)
          setMapReady(true)
        })

        mapRef.current = map
      })
      .catch(() => {
        /* style load failed */
      })

    return () => {
      cancelled = true
      markerRef.current?.remove()
      markerRef.current = null
      unbindTerrainGuard?.()
      unbindSeamarkRefresh?.()
      map?.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !mapReady || !marker || !isValidMapLngLat(position)) return

    marker.setLngLat([position.longitude, position.latitude])
    if (!marker.getElement().isConnected) {
      marker.addTo(map)
    }
  }, [mapReady, position])

  useEffect(() => {
    initialFitDoneRef.current = false
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || initialFitDoneRef.current) return
    if (!isValidMapLngLat(position)) return

    juiceMapFocus(map, position)
    initialFitDoneRef.current = true
  }, [mapReady, position])

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 200 })
  }, [])

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 200 })
  }, [])

  const handleLocate = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (isValidMapLngLat(position)) {
      centerMapOnPoint(map, position, SAILING_MAP_FOCUS_ZOOM)
      return
    }
    void centerMapOnCurrentLocation(map, { minZoom: SAILING_MAP_LOCATE_ZOOM })
  }, [position])

  const mapShell = (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden"
      style={{ backgroundColor: SailingMapColors.background }}
    >
      <DevComponentLabel name="WaypointPositionEditor" className="absolute left-2 top-2 z-10" />
      <div ref={containerRef} className={cn('sailing-map', mapClassName)} />
      {mapReady ? (
        <SailingMapControlStack
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocate={handleLocate}
          layers={
            <SailingMapLayerPanel
              toggles={mapDataLayerToggles}
              onChange={setMapDataLayerToggles}
            />
          }
          onExpand={allowFullscreen ? () => setFullscreenOpen(true) : undefined}
        />
      ) : null}
      <p
        className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full px-2.5 py-1 text-[10px] font-medium shadow-sm"
        style={{
          backgroundColor: `${SailingMapColors.chromeSurface}e6`,
          color: SailingMapColors.labelSecondary,
        }}
      >
        {hint}
      </p>
    </div>
  )

  return (
    <>
      {allowFullscreen ? (
        <div
          className="overflow-hidden rounded-[1.25rem] border"
          style={{ borderColor: SailingMapColors.chromeBorder }}
        >
          {mapShell}
        </div>
      ) : (
        mapShell
      )}
      {allowFullscreen && fullscreenOpen ? (
        <SailingMapFullscreenModal
          title="Waypoint position"
          onClose={() => setFullscreenOpen(false)}
        >
          <WaypointPositionEditor
            position={position}
            onPositionChange={onPositionChange}
            mapClassName="h-full w-full"
            allowFullscreen={false}
            hint={hint}
          />
        </SailingMapFullscreenModal>
      ) : null}
    </>
  )
}

function createDraftMarkerElement() {
  const el = document.createElement('div')
  el.id = DRAFT_MARKER_ID
  el.style.width = '22px'
  el.style.height = '22px'
  el.style.borderRadius = '9999px'
  el.style.background = mapBrandColor()
  el.style.border = '3px solid white'
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)'
  el.style.cursor = 'grab'
  return el
}
