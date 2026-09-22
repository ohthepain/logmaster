import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { addSailingMapAttributionControl } from '../lib/maplibre-attribution-control'
import {
  addOpenSeaMapSeamarkOverlay,
  finalizeSailingMapLayers,
  guardSailingMapAgainstTerrain,
  loadSailingMapStyle,
} from '../lib/maplibre-sailing-map-setup'
import {
  applySailingLogMapTheme,
  sailingMapLegTrackPaint,
} from '../lib/maplibre-sailing-theme'
import { getGeoJsonSource } from '../lib/maplibre-source'
import { defaultRasterMapId } from '../lib/map-styles'
import { SAILING_MAP_LOCATE_ZOOM } from '../lib/sailing-map-viewport'
import { mapTilerTransformRequest } from '../lib/tiles'
import { buildTripChatTrackCoordinates } from '../lib/trip-chat-hourly-map-track'
import type { TripChatTrackCoordinate } from '../lib/trip-chat-hourly-map-track'
import { useLogbookStore } from '../stores/logbook'

const TRACK_SOURCE = 'trip-chat-hourly-track'

type TripChatPositionMapProps = {
  tripId: string | null
  timestamp: string
  latitude: number
  longitude: number
}

function fitMapToTrack(
  map: maplibregl.Map,
  trackCoordinates: TripChatTrackCoordinate[],
  longitude: number,
  latitude: number,
) {
  if (trackCoordinates.length >= 2) {
    const bounds = trackCoordinates.reduce(
      (next, coordinate) => next.extend(coordinate),
      new maplibregl.LngLatBounds(trackCoordinates[0], trackCoordinates[0]),
    )
    map.fitBounds(bounds, { padding: 28, maxZoom: 14, duration: 0 })
    return
  }
  map.setCenter([longitude, latitude])
  map.setZoom(SAILING_MAP_LOCATE_ZOOM)
}

export function TripChatPositionMap({
  tripId,
  timestamp,
  latitude,
  longitude,
}: TripChatPositionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const allEntries = useLogbookStore((state) => state.entries)
  const allTracks = useLogbookStore((state) => state.tracks)
  const entries = useMemo(
    () =>
      tripId
        ? allEntries.filter(
            (entry) => entry.tripId === tripId && !entry.deleted,
          )
        : [],
    [allEntries, tripId],
  )
  const tracks = useMemo(
    () => (tripId ? allTracks.filter((track) => track.tripId === tripId) : []),
    [allTracks, tripId],
  )

  const trackCoordinates = useMemo(
    () =>
      buildTripChatTrackCoordinates({
        entries,
        tracks,
        endTimestamp: timestamp,
        endLatitude: latitude,
        endLongitude: longitude,
      }),
    [entries, latitude, longitude, timestamp, tracks],
  )
  const trackCoordinatesRef = useRef(trackCoordinates)
  trackCoordinatesRef.current = trackCoordinates

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    let cancelled = false
    let unbindTerrainGuard: (() => void) | undefined
    let map: maplibregl.Map | null = null

    void loadSailingMapStyle(defaultRasterMapId())
      .then((style) => {
        if (cancelled || mapRef.current) return

        map = new maplibregl.Map({
          container,
          style,
          center: [longitude, latitude],
          zoom: SAILING_MAP_LOCATE_ZOOM,
          pitch: 0,
          maxPitch: 0,
          attributionControl: false,
          transformRequest: (url) => mapTilerTransformRequest(url),
        })

        unbindTerrainGuard = guardSailingMapAgainstTerrain(map)
        addSailingMapAttributionControl(map, 'bottom-left')
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: true }),
          'top-right',
        )

        map.on('load', () => {
          if (!map) return
          applySailingLogMapTheme(map)
          addOpenSeaMapSeamarkOverlay(map)
          finalizeSailingMapLayers(map)

          const coordinates = trackCoordinatesRef.current
          map.addSource(TRACK_SOURCE, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates,
              },
              properties: {},
            },
          })
          map.addLayer({
            id: `${TRACK_SOURCE}-line`,
            type: 'line',
            source: TRACK_SOURCE,
            paint: sailingMapLegTrackPaint,
          })

          const marker = new maplibregl.Marker()
          marker.setLngLat([longitude, latitude])
          marker.addTo(map)
          markerRef.current = marker
          fitMapToTrack(map, coordinates, longitude, latitude)
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
      map?.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [latitude, longitude])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const source = getGeoJsonSource(map, TRACK_SOURCE)
    if (!source) return
    source.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: trackCoordinates },
      properties: {},
    })
    markerRef.current?.setLngLat([longitude, latitude])
    fitMapToTrack(map, trackCoordinates, longitude, latitude)
  }, [latitude, longitude, mapReady, trackCoordinates])

  return (
    <div
      ref={containerRef}
      data-testid="trip-chat-hourly-map"
      className="trip-chat-hourly-map sailing-map h-60 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
      role="region"
      aria-label={`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
    />
  )
}
