import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LogEntry, Trip } from '../domain/logbook'
import { DEV_FALLBACK_POSITION } from '../lib/logbook-context'
import {
  isValidMapLngLat,
  logEntryMapPoints,
  mapBrandColor,
} from '../lib/logbook-map-geo'
import type { MapLngLat } from '../lib/logbook-map-geo'
import {
  addOpenSeaMapSeamarkOverlay,
  bindSeamarkTileRefreshOnViewChange,
  finalizeSailingMapLayers,
  guardSailingMapAgainstTerrain,
  loadSailingMapStyle,
  scheduleSeamarkTileRefresh,
} from '../lib/maplibre-sailing-map-setup'
import { applySailingLogMapTheme, sailingMapOverlayPaint, SailingMapColors } from '../lib/maplibre-sailing-theme'
import { defaultRasterMapId } from '../lib/map-styles'
import { centerMapOnCurrentLocation, centerMapOnPoint } from '../lib/sailing-map-viewport'
import { mapTilerTransformRequest } from '../lib/tiles'
import { cn } from '../lib/cn'
import { DevComponentLabel } from './DevComponentLabel'
import { getGeoJsonSource } from '../lib/maplibre-source'
import { SailingMapControlStack } from './SailingMapControlStack'
import { SailingMapFullscreenModal } from './SailingMapFullscreenModal'

type LogEntryPositionMapProps = {
  trip: Trip
  entries: LogEntry[]
  position: MapLngLat | null
  onPositionChange: (position: MapLngLat) => void
  initialViewport?: 'current-location' | 'entry-focus'
  mapClassName?: string
  allowFullscreen?: boolean
}

const ENTRY_SOURCE = 'compose-log-entries'
const TRACK_SOURCE = 'compose-log-track'
const DRAFT_MARKER_ID = 'compose-draft-marker'

export function LogEntryPositionMap({
  trip,
  entries,
  position,
  onPositionChange,
  initialViewport = 'current-location',
  mapClassName = 'h-56 w-full sm:h-64',
  allowFullscreen = true,
}: LogEntryPositionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onPositionChangeRef = useRef(onPositionChange)
  const positionRef = useRef(position)
  const initialFitDoneRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  const entryCoords = useMemo(() => logEntryMapPoints(entries), [entries])

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange
  }, [onPositionChange])

  useEffect(() => {
    positionRef.current = position
  }, [position])

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

          map.addSource(TRACK_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })
          map.addLayer({
            id: 'compose-log-track-line',
            type: 'line',
            source: TRACK_SOURCE,
            paint: sailingMapOverlayPaint.track,
          })

          map.addSource(ENTRY_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })
          map.addLayer({
            id: 'compose-log-entry-circles',
            type: 'circle',
            source: ENTRY_SOURCE,
            paint: sailingMapOverlayPaint.entry,
          })

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
        /* style load failed — map stays blank */
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
    const map = mapRef.current
    if (!map || !mapReady) return

    const trackSource = getGeoJsonSource(map, TRACK_SOURCE)
    const entrySource = getGeoJsonSource(map, ENTRY_SOURCE)
    if (!trackSource || !entrySource) return

    trackSource.setData(
      entryCoords.length >= 2
        ? {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: entryCoords.map((point) => [
                point.longitude,
                point.latitude,
              ]),
            },
            properties: {},
          }
        : { type: 'FeatureCollection', features: [] },
    )

    entrySource.setData({
      type: 'FeatureCollection',
      features: entryCoords.map((point) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.longitude, point.latitude],
        },
        properties: {},
      })),
    })
  }, [mapReady, entryCoords])

  useEffect(() => {
    initialFitDoneRef.current = false
  }, [trip.id, initialViewport])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || initialFitDoneRef.current) return
    if (!isValidMapLngLat(position)) return

    centerMapOnPoint(map, position, 14)
    initialFitDoneRef.current = true
  }, [mapReady, initialViewport, position, trip.id])

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 200 })
  }, [])

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 200 })
  }, [])

  const handleLocate = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (initialViewport === 'entry-focus' && isValidMapLngLat(position)) {
      centerMapOnPoint(map, position, 14)
      return
    }
    void centerMapOnCurrentLocation(map)
  }, [initialViewport, position])

  const mapShell = (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden"
      style={{ backgroundColor: SailingMapColors.background }}
    >
      <DevComponentLabel name="LogEntryPositionMap" className="absolute left-2 top-2 z-10" />
      <div ref={containerRef} className={cn('sailing-map', mapClassName)} />
      {mapReady ? (
        <SailingMapControlStack
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocate={handleLocate}
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
        Drag pin or tap map to adjust
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
          title="Log entry position"
          onClose={() => setFullscreenOpen(false)}
        >
          <LogEntryPositionMap
            trip={trip}
            entries={entries}
            position={position}
            onPositionChange={onPositionChange}
            mapClassName="h-full w-full"
            allowFullscreen={false}
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
