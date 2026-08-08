import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, Leg, Trip } from "../domain/logbook";
import { DEV_FALLBACK_POSITION, setDevPositionOverride, subscribeToDevicePosition } from "../lib/logbook-context";
import { isDevModeAvailable } from "../lib/dev-mode";
import { buildLegEntryPointsGeoJson, buildLegTrackGeoJson, mapBrandColor, mapPointsToBounds, resolveTripLogMapViewport } from "../lib/logbook-map-geo";
import { createCurrentPositionMarkerElement } from "../lib/map-current-position-marker";
import {
  addOpenSeaMapSeamarkOverlay,
  bindSeamarkTileRefreshOnViewChange,
  finalizeSailingMapLayers,
  guardSailingMapAgainstTerrain,
  loadSailingMapStyle,
  scheduleSeamarkTileRefresh,
} from "../lib/maplibre-sailing-map-setup";
import { installMapDataLayers } from "../lib/maplibre-data-layers";
import { useMapDataLayerSync } from "../lib/use-map-data-layer-sync";
import { applySailingLogMapTheme, sailingMapLegEntryPaint, sailingMapLegTrackPaint, SailingMapColors } from "../lib/maplibre-sailing-theme";
import { getGeoJsonSource } from "../lib/maplibre-source";
import { defaultRasterMapId } from "../lib/map-styles";
import { centerMapOnCurrentLocation, juiceMapFocus, SAILING_MAP_EASE_MS, SAILING_MAP_FIT_MAX_ZOOM, SAILING_MAP_INITIAL_ZOOM } from "../lib/sailing-map-viewport";
import {
  fetchReversePlaceLookup,
  formatReversePlaceLabel,
} from "../lib/place-reverse-lookup-api";
import { mapTilerTransformRequest } from "../lib/tiles";
import { cn } from "../lib/cn";
import { useAppOptionsStore } from "../stores/app-options";
import { DevComponentLabel } from "./DevComponentLabel";
import { SailingMapControlStack } from "./SailingMapControlStack";
import { SailingMapFullscreenModal } from "./SailingMapFullscreenModal";
import { SailingMapLayerPanel } from "./SailingMapLayerPanel";

type TripLogMapProps = {
  trip: Trip;
  entries: LogEntry[];
  legs?: Leg[];
  focusEntryId?: string | null;
  mapClassName?: string;
  allowFullscreen?: boolean;
  showControls?: boolean;
  showCurrentPosition?: boolean;
  interactive?: boolean;
  embedded?: boolean;
  showSeamarks?: boolean;
  controlStackClassName?: string;
};

type LngLat = { longitude: number; latitude: number };

const ENTRY_SOURCE = "trip-log-entries";
const TRACK_SOURCE = "trip-log-track";
const CURRENT_SOURCE = "trip-current-position";

export function TripLogMap({
  trip,
  entries,
  legs = [],
  focusEntryId = null,
  mapClassName = "h-56 w-full sm:h-64",
  allowFullscreen = true,
  showControls = true,
  showCurrentPosition = true,
  interactive = true,
  embedded = false,
  showSeamarks = true,
  controlStackClassName,
}: TripLogMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentPositionMarkerRef = useRef<maplibregl.Marker | null>(null);
  const initialFitDoneRef = useRef(false);
  const devMode = useAppOptionsStore((state) => state.devMode);
  const mapDataLayerToggles = useAppOptionsStore((state) => state.mapDataLayerToggles);
  const setMapDataLayerToggles = useAppOptionsStore((state) => state.setMapDataLayerToggles);
  const devDraggablePosition =
    devMode && isDevModeAvailable() && showCurrentPosition && interactive;
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<LngLat | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  useMapDataLayerSync(mapRef, mapReady, mapDataLayerToggles, {
    enablePopups: interactive,
    seamarksAllowed: showSeamarks,
  });

  const legTrackGeoJson = useMemo(() => buildLegTrackGeoJson(entries, legs), [entries, legs]);
  const legEntryGeoJson = useMemo(() => buildLegEntryPointsGeoJson(entries, legs), [entries, legs]);
  const viewportTarget = useMemo(
    () => resolveTripLogMapViewport(trip, entries, { focusEntryId }),
    [trip, entries, focusEntryId],
  );

  useEffect(() => {
    if (!showCurrentPosition) {
      setCurrentPosition(null);
    }
  }, [showCurrentPosition]);

  useEffect(() => {
    if (!showCurrentPosition) return;
    return subscribeToDevicePosition((position) => {
      if (position.latitude == null || position.longitude == null) {
        setCurrentPosition({
          longitude: DEV_FALLBACK_POSITION.longitude,
          latitude: DEV_FALLBACK_POSITION.latitude,
        });
        return;
      }
      setCurrentPosition({
        longitude: position.longitude,
        latitude: position.latitude,
      });
    });
  }, [showCurrentPosition]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let cancelled = false;
    let unbindTerrainGuard: (() => void) | undefined;
    let unbindSeamarkRefresh: (() => void) | undefined;
    let map: maplibregl.Map | null = null;

    void loadSailingMapStyle(defaultRasterMapId())
      .then((style) => {
        if (cancelled || mapRef.current) return;

        map = new maplibregl.Map({
          container,
          style,
          center: [DEV_FALLBACK_POSITION.longitude, DEV_FALLBACK_POSITION.latitude],
          zoom: SAILING_MAP_INITIAL_ZOOM,
          pitch: 0,
          maxPitch: 0,
          attributionControl: false,
          interactive,
          transformRequest: (url) => mapTilerTransformRequest(url),
        });

        unbindTerrainGuard = guardSailingMapAgainstTerrain(map);

        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

        map.on("load", () => {
          if (!map) return;
          applySailingLogMapTheme(map);
          addOpenSeaMapSeamarkOverlay(map);
          installMapDataLayers(map);

          map.addSource(TRACK_SOURCE, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "trip-log-track-line",
            type: "line",
            source: TRACK_SOURCE,
            paint: sailingMapLegTrackPaint,
          });

          map.addSource(ENTRY_SOURCE, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "trip-log-entry-circles",
            type: "circle",
            source: ENTRY_SOURCE,
            paint: sailingMapLegEntryPaint,
          });

          map.addSource(CURRENT_SOURCE, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "trip-current-position-halo",
            type: "circle",
            source: CURRENT_SOURCE,
            paint: {
              "circle-radius": 14,
              "circle-color": mapBrandColor(),
              "circle-opacity": 0.2,
            },
          });
          map.addLayer({
            id: "trip-current-position-dot",
            type: "circle",
            source: CURRENT_SOURCE,
            paint: {
              "circle-radius": 6,
              "circle-color": mapBrandColor(),
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });

          finalizeSailingMapLayers(map);
          scheduleSeamarkTileRefresh(map);
          unbindSeamarkRefresh = bindSeamarkTileRefreshOnViewChange(map);

          setMapReady(true);
        });

        map.on("error", (event) => {
          const message = event.error instanceof Error ? event.error.message : "Could not load map";
          setMapError(message);
        });

        mapRef.current = map;
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not load map";
        setMapError(message);
      });

    return () => {
      cancelled = true;
      unbindTerrainGuard?.();
      unbindSeamarkRefresh?.();
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [interactive]);

  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;
    if (!container || !map || !mapReady) return;

    const resize = () => map.resize();
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const trackSource = getGeoJsonSource(map, TRACK_SOURCE);
    const entrySource = getGeoJsonSource(map, ENTRY_SOURCE);
    const currentSource = getGeoJsonSource(map, CURRENT_SOURCE);
    if (!trackSource || !entrySource || !currentSource) return;

    trackSource.setData(legTrackGeoJson);
    entrySource.setData(legEntryGeoJson);

    currentSource.setData({
      type: "FeatureCollection",
      features:
        showCurrentPosition && currentPosition && !devDraggablePosition
          ? [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [currentPosition.longitude, currentPosition.latitude],
                },
                properties: {},
              },
            ]
          : [],
    });
  }, [mapReady, legTrackGeoJson, legEntryGeoJson, currentPosition, showCurrentPosition, devDraggablePosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !devDraggablePosition) {
      currentPositionMarkerRef.current?.remove();
      currentPositionMarkerRef.current = null;
      return;
    }

    const marker = new maplibregl.Marker({
      element: createCurrentPositionMarkerElement({ devDraggable: true }),
      draggable: true,
      anchor: "center",
    });

    marker.on("dragstart", () => {
      marker.getElement().style.cursor = "grabbing";
    });

    marker.on("dragend", () => {
      marker.getElement().style.cursor = "grab";
      const lngLat = marker.getLngLat();
      setDevPositionOverride({
        latitude: lngLat.lat,
        longitude: lngLat.lng,
      });
      void fetchReversePlaceLookup(lngLat.lat, lngLat.lng).then((place) => {
        if (place) {
          console.info(
            "[dev position] nearest place:",
            formatReversePlaceLabel(place),
            place,
          );
          return;
        }
        console.info("[dev position] no named place within lookup range", {
          latitude: lngLat.lat,
          longitude: lngLat.lng,
        });
      });
    });

    currentPositionMarkerRef.current = marker;

    return () => {
      marker.remove();
      currentPositionMarkerRef.current = null;
    };
  }, [mapReady, devDraggablePosition]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = currentPositionMarkerRef.current;
    if (!map || !mapReady || !devDraggablePosition || !marker || !currentPosition) return;

    marker.setLngLat([currentPosition.longitude, currentPosition.latitude]);
    if (!marker.getElement().isConnected) {
      marker.addTo(map);
    }
  }, [mapReady, devDraggablePosition, currentPosition]);

  useEffect(() => {
    initialFitDoneRef.current = false;
  }, [trip.id, focusEntryId, viewportTarget.kind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || initialFitDoneRef.current) return;

    if (viewportTarget.kind === "current-location") {
      if (!showCurrentPosition || !currentPosition) return;
      juiceMapFocus(map, currentPosition);
      initialFitDoneRef.current = true;
      return;
    }

    if (viewportTarget.kind === "point") {
      juiceMapFocus(map, viewportTarget.point);
      initialFitDoneRef.current = true;
      return;
    }

    const bounds = mapPointsToBounds(viewportTarget.points);
    if (bounds) {
      map.fitBounds(bounds, {
        padding: embedded ? 24 : 48,
        maxZoom: SAILING_MAP_FIT_MAX_ZOOM,
        duration: SAILING_MAP_EASE_MS,
      });
      initialFitDoneRef.current = true;
    }
  }, [
    mapReady,
    viewportTarget,
    currentPosition,
    showCurrentPosition,
    embedded,
  ]);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 200 });
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 200 });
  }, []);

  const handleLocate = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    void centerMapOnCurrentLocation(map);
  }, []);

  const mapShell = (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden"
      style={{ backgroundColor: SailingMapColors.background }}
    >
      {!embedded ? (
        <DevComponentLabel name="TripLogMap" className="absolute left-2 top-2 z-10" />
      ) : null}
      <div ref={containerRef} className={cn("sailing-map", mapClassName)} />
      {mapReady && showControls ? (
        <>
          <SailingMapControlStack
            className={controlStackClassName}
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
        </>
      ) : null}
      {mapReady && devDraggablePosition ? (
        <p
          className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full px-2.5 py-1 text-[10px] font-medium shadow-sm"
          style={{
            backgroundColor: `${SailingMapColors.chromeSurface}e6`,
            color: SailingMapColors.labelSecondary,
          }}
        >
          Dev: drag position dot to fake GPS
        </p>
      ) : null}
      {mapError ? (
        <p
          className="m-0 border-t px-4 py-2 text-xs"
          style={{
            borderColor: SailingMapColors.chromeBorder,
            color: SailingMapColors.labelSecondary,
          }}
        >
          {mapError}
        </p>
      ) : null}
    </div>
  );

  const fullscreenModal =
    allowFullscreen && fullscreenOpen ? (
      <SailingMapFullscreenModal title="Trip map" onClose={() => setFullscreenOpen(false)}>
        <DevComponentLabel name="TripLogMap" />

        <TripLogMap
          trip={trip}
          entries={entries}
          legs={legs}
          focusEntryId={focusEntryId}
          mapClassName="h-full w-full"
          allowFullscreen={false}
        />
      </SailingMapFullscreenModal>
    ) : null;

  if (embedded) {
    return (
      <>
        {mapShell}
        {fullscreenModal}
      </>
    );
  }

  return (
    <>
      {allowFullscreen ? (
        <div
          className="overflow-hidden rounded-[1.5rem] border"
          style={{ borderColor: SailingMapColors.chromeBorder }}
        >
          {mapShell}
        </div>
      ) : (
        mapShell
      )}
      {fullscreenModal}
    </>
  );
}
