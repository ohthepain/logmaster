import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogEntry, Trip } from '../domain/logbook'
import { DEV_FALLBACK_POSITION, subscribeToDevicePosition } from '../lib/logbook-context'
import {
  logEntryMapPoints,
  mapBrandColor,
  mapPointsToBounds,
  tripStartMapPoint,
} from '../lib/logbook-map-geo'
import {
  addOpenSeaMapSeamarkOverlay,
  OPEN_SEAMAP_ATTRIBUTION,
} from '../lib/maplibre-openseamap'
import { applySailingLogMapTheme, sailingMapOverlayPaint } from '../lib/maplibre-sailing-theme'
import { getGeoJsonSource } from '../lib/maplibre-source'
import { defaultRasterMapId } from '../lib/map-styles'
import { appMapVectorStyleUrl, mapTilerTransformRequest } from '../lib/tiles'
import { DevComponentLabel } from './DevComponentLabel'

type TripLogMapProps = {
  trip: Trip
  entries: LogEntry[]
}

type LngLat = { longitude: number; latitude: number }

const ENTRY_SOURCE = 'trip-log-entries'
const TRACK_SOURCE = 'trip-log-track'
const CURRENT_SOURCE = 'trip-current-position'

export function TripLogMap({ trip, entries }: TripLogMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const initialFitDoneRef = useRef(false)
  const currentPositionRef = useRef<LngLat | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [currentPosition, setCurrentPosition] = useState<LngLat | null>(null)

  const entryCoords = useMemo(() => logEntryMapPoints(entries), [entries])

  useEffect(() => {
    return subscribeToDevicePosition((position) => {
      if (position.latitude == null || position.longitude == null) {
        setCurrentPosition({
          longitude: DEV_FALLBACK_POSITION.longitude,
          latitude: DEV_FALLBACK_POSITION.latitude,
        })
        return
      }
      setCurrentPosition({
        longitude: position.longitude,
        latitude: position.latitude,
      })
    })
  }, [])

  useEffect(() => {
    currentPositionRef.current = currentPosition
  }, [currentPosition])

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
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: OPEN_SEAMAP_ATTRIBUTION,
      }),
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
        id: 'trip-log-track-line',
        type: 'line',
        source: TRACK_SOURCE,
        paint: sailingMapOverlayPaint.track,
      })

      map.addSource(ENTRY_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'trip-log-entry-circles',
        type: 'circle',
        source: ENTRY_SOURCE,
        paint: sailingMapOverlayPaint.entry,
      })

      map.addSource(CURRENT_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'trip-current-position-halo',
        type: 'circle',
        source: CURRENT_SOURCE,
        paint: {
          'circle-radius': 14,
          'circle-color': mapBrandColor(),
          'circle-opacity': 0.2,
        },
      })
      map.addLayer({
        id: 'trip-current-position-dot',
        type: 'circle',
        source: CURRENT_SOURCE,
        paint: {
          'circle-radius': 6,
          'circle-color': mapBrandColor(),
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      setMapReady(true)
    })

    map.on('error', (event) => {
      const message =
        event.error instanceof Error
          ? event.error.message
          : 'Could not load map'
      setMapError(message)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const trackSource = getGeoJsonSource(map, TRACK_SOURCE)
    const entrySource = getGeoJsonSource(map, ENTRY_SOURCE)
    const currentSource = getGeoJsonSource(map, CURRENT_SOURCE)
    if (!trackSource || !entrySource || !currentSource) return

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
      features: entryCoords.map((point, index) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.longitude, point.latitude],
        },
        properties: { index: index + 1 },
      })),
    })

    currentSource.setData({
      type: 'FeatureCollection',
      features: currentPosition
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [currentPosition.longitude, currentPosition.latitude],
              },
              properties: {},
            },
          ]
        : [],
    })
  }, [mapReady, entryCoords, currentPosition])

  useEffect(() => {
    initialFitDoneRef.current = false
  }, [trip.id])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const fitPoints = [...entryCoords]
    const start = tripStartMapPoint(trip)
    if (start) fitPoints.push(start)
    if (currentPositionRef.current) fitPoints.push(currentPositionRef.current)

    const bounds = mapPointsToBounds(fitPoints)
    if (bounds) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 600 })
      initialFitDoneRef.current = true
    }
  }, [mapReady, entryCoords, trip.id, trip.startLatitude, trip.startLongitude])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || initialFitDoneRef.current || entryCoords.length > 0) {
      return
    }
    if (!currentPosition) return
    map.easeTo({
      center: [currentPosition.longitude, currentPosition.latitude],
      zoom: 12,
      duration: 600,
    })
    initialFitDoneRef.current = true
  }, [mapReady, currentPosition, entryCoords.length])

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-[#1a3044] bg-[#070f18]">
      <DevComponentLabel name="TripLogMap" className="absolute left-2 top-2 z-10" />
      <div ref={containerRef} className="sailing-map h-56 w-full sm:h-64" />
      {mapError && (
        <p className="m-0 border-t border-[#1a3044] px-4 py-2 text-xs text-[#b8c5d0]">
          {mapError}
        </p>
      )}
    </div>
  )
}
