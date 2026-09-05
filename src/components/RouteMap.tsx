import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Route, RouteWaypoint } from '../domain/route'
import { DEV_FALLBACK_POSITION } from '../lib/logbook-context'
import { captureMaplibreSnapshot, withCaptureTimeout } from '../lib/map-cover-capture'
import {
  buildRouteLineGeoJson,
  buildRouteWaypointPointsGeoJson,
  mapPointsToBounds,
  routeMapPoints,
} from '../lib/route-map-geo'
import {
  addRouteWaypointSymbolLayer,
  routeLinePaint,
  syncRouteMapMarkerImages,
} from '../lib/route-map-icons'
import {
  addOpenSeaMapSeamarkOverlay,
  addOpenSeaMapBathymetryOverlays,
  bindSeamarkTileRefreshOnViewChange,
  finalizeSailingMapLayers,
  guardSailingMapAgainstTerrain,
  loadSailingMapStyle,
  scheduleSeamarkTileRefresh,
} from '../lib/maplibre-sailing-map-setup'
import { applySailingLogMapTheme } from '../lib/maplibre-sailing-theme'
import { getGeoJsonSource } from '../lib/maplibre-source'
import { defaultRasterMapId } from '../lib/map-styles'
import { installMapDataLayers } from '../lib/maplibre-data-layers'
import { installAisMapLayer } from '../lib/maplibre-ais-layer'
import {
  centerMapOnPoint,
  fitMapToTripTrack,
  SAILING_MAP_FOCUS_ZOOM,
  SAILING_MAP_INITIAL_ZOOM,
} from '../lib/sailing-map-viewport'
import { mapTilerTransformRequest } from '../lib/tiles'
import type { TripMapHandle } from '../lib/trip-map-handle'
import { getNativePlatform } from '../lib/platform'
import { resolveMapDataLayerToggle } from '../lib/map-data-layers'
import { useAisMapLayer } from '../lib/use-ais-map-layer'
import {
  scheduleMapDataLayerViewportSync,
  syncMapDataLayersForViewport,
  effectiveMapDataLayerToggles,
  useMapDataLayerSync,
} from '../lib/use-map-data-layer-sync'
import { useAppOptionsStore } from '../stores/app-options'
import { useLogbookStore } from '../stores/logbook'
import { cn } from '../lib/cn'
import { SailingMapControlStack } from './SailingMapControlStack'
import { SailingMapFullscreenModal } from './SailingMapFullscreenModal'
import { SailingMapLayerPanel } from './SailingMapLayerPanel'

const LINE_SOURCE = 'route-line'
const WAYPOINT_SOURCE = 'route-waypoints'
const LINE_LAYER = 'route-planned-line'
const WAYPOINT_LAYER = 'route-waypoint-icons'

type RouteMapProps = {
  route: Route
  waypoints: RouteWaypoint[]
  className?: string
  showControls?: boolean
  allowFullscreen?: boolean
  onInitialViewportSettled?: () => void
}

export const RouteMap = forwardRef<TripMapHandle, RouteMapProps>(function RouteMap(
  {
    route,
    waypoints,
    className = 'h-56 w-full sm:h-72',
    showControls = true,
    allowFullscreen = true,
    onInitialViewportSettled,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const initialViewportNotifiedRef = useRef(false)
  const initialFitDoneRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapFullscreenOpen, setMapFullscreenOpen] = useState(false)
  const mapDataLayerToggles = useAppOptionsStore((state) => state.mapDataLayerToggles)
  const setMapDataLayerToggles = useAppOptionsStore((state) => state.setMapDataLayerToggles)
  const online = useLogbookStore((state) => state.online)
  const showMapDataLayers = getNativePlatform() !== 'ios'
  const aisEnabled = resolveMapDataLayerToggle(mapDataLayerToggles, 'ais-live')

  useMapDataLayerSync(mapRef, mapReady, mapDataLayerToggles, {
    enablePopups: true,
  })
  useAisMapLayer(mapRef, mapReady, {
    enabled: aisEnabled,
    online,
    allowAis: true,
    enablePopups: true,
  })

  const aisViewportSync = useMemo(
    () => ({ enabled: aisEnabled, online }),
    [aisEnabled, online],
  )

  const lineGeoJson = useMemo(() => buildRouteLineGeoJson(waypoints), [waypoints])
  const waypointGeoJson = useMemo(
    () => buildRouteWaypointPointsGeoJson(waypoints),
    [waypoints],
  )

  const notifyInitialViewportSettled = useCallback(() => {
    if (initialViewportNotifiedRef.current) return
    initialViewportNotifiedRef.current = true
    onInitialViewportSettled?.()
  }, [onInitialViewportSettled])

  const settleInitialViewport = useCallback(
    (map: maplibregl.Map) => {
      map.once('idle', () => notifyInitialViewportSettled())
    },
    [notifyInitialViewportSettled],
  )

  const fitRouteBounds = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const points = routeMapPoints(waypoints)
    const bounds = mapPointsToBounds(points)
    if (bounds) {
      fitMapToTripTrack(map, bounds)
      return
    }
    if (points.length > 0) {
      centerMapOnPoint(map, points[0]!, SAILING_MAP_FOCUS_ZOOM)
    }
  }, [waypoints])

  const captureMapSnapshot = useCallback(async () => {
    const map = mapRef.current
    if (!map || !mapReady) return null
    return withCaptureTimeout(captureMaplibreSnapshot(map))
  }, [mapReady])

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => mapRef.current?.zoomIn({ duration: 200 }),
      zoomOut: () => mapRef.current?.zoomOut({ duration: 200 }),
      locate: fitRouteBounds,
      captureMapSnapshot,
    }),
    [captureMapSnapshot, fitRouteBounds],
  )

  useEffect(() => {
    initialViewportNotifiedRef.current = false
    initialFitDoneRef.current = false
  }, [route.id])

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
          zoom: SAILING_MAP_INITIAL_ZOOM,
          pitch: 0,
          maxPitch: 0,
          attributionControl: false,
          interactive: true,
          canvasContextAttributes: { preserveDrawingBuffer: true },
          transformRequest: (url) => mapTilerTransformRequest(url),
        })

        unbindTerrainGuard = guardSailingMapAgainstTerrain(map)
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

        map.on('load', () => {
          if (!map) return
          applySailingLogMapTheme(map)
          addOpenSeaMapSeamarkOverlay(map)
          addOpenSeaMapBathymetryOverlays(map)
          installMapDataLayers(map)
          installAisMapLayer(map)

          map.addSource(LINE_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })
          map.addLayer({
            id: LINE_LAYER,
            type: 'line',
            source: LINE_SOURCE,
            paint: routeLinePaint,
          })

          map.addSource(WAYPOINT_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })
          addRouteWaypointSymbolLayer(map, WAYPOINT_SOURCE, WAYPOINT_LAYER)

          finalizeSailingMapLayers(map)
          scheduleSeamarkTileRefresh(map)
          unbindSeamarkRefresh = bindSeamarkTileRefreshOnViewChange(map)

          void syncMapDataLayersForViewport(
            map,
            effectiveMapDataLayerToggles(
              useAppOptionsStore.getState().mapDataLayerToggles,
            ),
          )

          setMapReady(true)
        })

        mapRef.current = map
      })
      .catch(() => {
        // map load failure is non-fatal for route preview
      })

    return () => {
      cancelled = true
      unbindTerrainGuard?.()
      unbindSeamarkRefresh?.()
      map?.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const map = mapRef.current
    if (!container || !map || !mapReady) return

    const resize = () => map.resize()
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const lineSource = getGeoJsonSource(map, LINE_SOURCE)
    if (lineSource) lineSource.setData(lineGeoJson)
  }, [mapReady, lineGeoJson])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const waypointSource = getGeoJsonSource(map, WAYPOINT_SOURCE)
    if (!waypointSource) return

    let cancelled = false
    void syncRouteMapMarkerImages(map, waypointGeoJson).then(() => {
      if (cancelled) return
      waypointSource.setData(waypointGeoJson)
    })

    return () => {
      cancelled = true
    }
  }, [mapReady, waypointGeoJson])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || initialFitDoneRef.current) return

    const points = routeMapPoints(waypoints)
    const bounds = mapPointsToBounds(points)
    if (bounds) {
      fitMapToTripTrack(map, bounds)
    } else if (points.length > 0) {
      centerMapOnPoint(map, points[0]!, SAILING_MAP_FOCUS_ZOOM)
    } else {
      initialFitDoneRef.current = true
      notifyInitialViewportSettled()
      return
    }

    scheduleMapDataLayerViewportSync(
      map,
      useAppOptionsStore.getState().mapDataLayerToggles,
      { ais: aisViewportSync },
    )
    settleInitialViewport(map)
    initialFitDoneRef.current = true
  }, [
    mapReady,
    waypoints,
    route.id,
    notifyInitialViewportSettled,
    settleInitialViewport,
    aisViewportSync,
  ])

  const mapRoundedClass = className.includes('rounded-none')
    ? 'rounded-none'
    : 'rounded-[1.5rem]'

  return (
    <>
      <div className={cn('relative h-full min-h-0 w-full overflow-hidden', mapRoundedClass, className)}>
        <div
          ref={containerRef}
          className="sailing-map absolute inset-0 size-full"
          aria-label={`Map for ${route.title}`}
        />
        {showControls ? (
          <SailingMapControlStack
            onZoomIn={() => mapRef.current?.zoomIn({ duration: 200 })}
            onZoomOut={() => mapRef.current?.zoomOut({ duration: 200 })}
            onLocate={fitRouteBounds}
            locateLabel="Fit route"
            layers={
              showMapDataLayers ? (
                <SailingMapLayerPanel
                  toggles={mapDataLayerToggles}
                  onChange={setMapDataLayerToggles}
                  aisPlannedRouteHint
                />
              ) : undefined
            }
            onExpand={allowFullscreen ? () => setMapFullscreenOpen(true) : undefined}
          />
        ) : null}
      </div>

      {mapFullscreenOpen ? (
        <SailingMapFullscreenModal title={route.title} onClose={() => setMapFullscreenOpen(false)}>
          <RouteMap
            route={route}
            waypoints={waypoints}
            className="absolute inset-0 size-full rounded-none"
            showControls
            allowFullscreen={false}
          />
        </SailingMapFullscreenModal>
      ) : null}
    </>
  )
})
