import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogEntry, Trip } from '../domain/logbook'
import { DEV_FALLBACK_POSITION } from '../lib/logbook-context'
import {
  logEntryMapPoints,
  mapBrandColor,
  mapPointsToBounds,
  tripStartMapPoint,
} from '../lib/logbook-map-geo'
import type { MapLngLat } from '../lib/logbook-map-geo'
import {
  addOpenSeaMapSeamarkOverlay,
} from '../lib/maplibre-openseamap'
import { applySailingLogMapTheme, sailingMapOverlayPaint } from '../lib/maplibre-sailing-theme'
import { defaultRasterMapId } from '../lib/map-styles'
import { appMapVectorStyleUrl, mapTilerTransformRequest } from '../lib/tiles'
import { DevComponentLabel } from './DevComponentLabel'
import { getGeoJsonSource } from '../lib/maplibre-source'

type LogEntryPositionMapProps = {
  trip: Trip
  entries: LogEntry[]
  position: MapLngLat | null
  onPositionChange: (position: MapLngLat) => void
}

const ENTRY_SOURCE = 'compose-log-entries'
const TRACK_SOURCE = 'compose-log-track'
const DRAFT_MARKER_ID = 'compose-draft-marker'

export function LogEntryPositionMap({
  trip,
  entries,
  position,
  onPositionChange,
}: LogEntryPositionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onPositionChangeRef = useRef(onPositionChange)
  const initialFitDoneRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)

  const entryCoords = useMemo(() => logEntryMapPoints(entries), [entries])

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange
  }, [onPositionChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const map = new maplibregl.Map({
      container,
      style: appMapVectorStyleUrl(defaultRasterMapId()),
      center: [DEV_FALLBACK_POSITION.longitude, DEV_FALLBACK_POSITION.latitude],
      zoom: 10,
      attributionControl: false,
      transformRequest: (url) => mapTilerTransformRequest(url),
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right',
    )

    map.on('load', () => {
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
        onPositionChangeRef.current({
          longitude: lngLat.lng,
          latitude: lngLat.lat,
        })
      })
      markerRef.current = marker

      map.on('click', (event) => {
        marker.setLngLat(event.lngLat)
        onPositionChangeRef.current({
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
        })
      })

      setMapReady(true)
    })

    mapRef.current = map
    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !mapReady || !marker || !position) return

    if (!marker.getElement().isConnected) {
      marker.addTo(map)
    }
    marker.setLngLat([position.longitude, position.latitude])
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
  }, [trip.id])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const fitPoints = [...entryCoords]
    const start = tripStartMapPoint(trip)
    if (start) fitPoints.push(start)
    if (position) fitPoints.push(position)

    const bounds = mapPointsToBounds(fitPoints)
    if (bounds) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 600 })
      initialFitDoneRef.current = true
    }
  }, [mapReady, entryCoords, trip.id, trip.startLatitude, trip.startLongitude])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || initialFitDoneRef.current || entryCoords.length > 0) {
      return
    }
    if (!position) return
    map.easeTo({
      center: [position.longitude, position.latitude],
      zoom: 12,
      duration: 600,
    })
    initialFitDoneRef.current = true
  }, [mapReady, position, entryCoords.length])

  return (
    <div className="relative overflow-hidden rounded-[1.25rem] border border-[#1a3044] bg-[#070f18]">
      <DevComponentLabel name="LogEntryPositionMap" className="absolute left-2 top-2 z-10" />
      <div ref={containerRef} className="sailing-map h-56 w-full sm:h-64" />
      <p className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-[#0c1f33]/90 px-2.5 py-1 text-[10px] font-medium text-[#b8c5d0] shadow-sm">
        Drag pin or tap map to adjust
      </p>
    </div>
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
