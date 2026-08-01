import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, Trip } from "../domain/logbook";
import { DEV_FALLBACK_POSITION, subscribeToDevicePosition } from "../lib/logbook-context";
import { logEntryMapPoints, mapBrandColor, mapPointsToBounds, tripStartMapPoint } from "../lib/logbook-map-geo";
import {
  addOpenSeaMapSeamarkOverlay,
  bindSeamarkTileRefreshOnViewChange,
  finalizeSailingMapLayers,
  guardSailingMapAgainstTerrain,
  loadSailingMapStyle,
  scheduleSeamarkTileRefresh,
} from "../lib/maplibre-sailing-map-setup";
import { applySailingLogMapTheme, sailingMapOverlayPaint } from "../lib/maplibre-sailing-theme";
import { getGeoJsonSource } from "../lib/maplibre-source";
import { defaultRasterMapId } from "../lib/map-styles";
import { centerMapOnCurrentLocation } from "../lib/sailing-map-viewport";
import { mapTilerTransformRequest } from "../lib/tiles";
import { cn } from "../lib/cn";
import { DevComponentLabel } from "./DevComponentLabel";
import { SailingMapControlStack } from "./SailingMapControlStack";
import { SailingMapFullscreenModal } from "./SailingMapFullscreenModal";

type TripLogMapProps = {
  trip: Trip;
  entries: LogEntry[];
  mapClassName?: string;
  allowFullscreen?: boolean;
};

type LngLat = { longitude: number; latitude: number };

const ENTRY_SOURCE = "trip-log-entries";
const TRACK_SOURCE = "trip-log-track";
const CURRENT_SOURCE = "trip-current-position";

export function TripLogMap({
  trip,
  entries,
  mapClassName = "h-56 w-full sm:h-64",
  allowFullscreen = true,
}: TripLogMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initialFitDoneRef = useRef(false);
  const currentPositionRef = useRef<LngLat | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<LngLat | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const entryCoords = useMemo(() => logEntryMapPoints(entries), [entries]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);

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
          zoom: 10,
          pitch: 0,
          maxPitch: 0,
          attributionControl: false,
          transformRequest: (url) => mapTilerTransformRequest(url),
        });

        unbindTerrainGuard = guardSailingMapAgainstTerrain(map);

        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

        map.on("load", () => {
          if (!map) return;
          applySailingLogMapTheme(map);
          addOpenSeaMapSeamarkOverlay(map);

          map.addSource(TRACK_SOURCE, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "trip-log-track-line",
            type: "line",
            source: TRACK_SOURCE,
            paint: sailingMapOverlayPaint.track,
          });

          map.addSource(ENTRY_SOURCE, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "trip-log-entry-circles",
            type: "circle",
            source: ENTRY_SOURCE,
            paint: sailingMapOverlayPaint.entry,
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
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const trackSource = getGeoJsonSource(map, TRACK_SOURCE);
    const entrySource = getGeoJsonSource(map, ENTRY_SOURCE);
    const currentSource = getGeoJsonSource(map, CURRENT_SOURCE);
    if (!trackSource || !entrySource || !currentSource) return;

    trackSource.setData(
      entryCoords.length >= 2
        ? {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: entryCoords.map((point) => [point.longitude, point.latitude]),
            },
            properties: {},
          }
        : { type: "FeatureCollection", features: [] },
    );

    entrySource.setData({
      type: "FeatureCollection",
      features: entryCoords.map((point, index) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [point.longitude, point.latitude],
        },
        properties: { index: index + 1 },
      })),
    });

    currentSource.setData({
      type: "FeatureCollection",
      features: currentPosition
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
  }, [mapReady, entryCoords, currentPosition]);

  useEffect(() => {
    initialFitDoneRef.current = false;
  }, [trip.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const fitPoints = [...entryCoords];
    const start = tripStartMapPoint(trip);
    if (start) fitPoints.push(start);
    if (currentPositionRef.current) fitPoints.push(currentPositionRef.current);

    const bounds = mapPointsToBounds(fitPoints);
    if (bounds) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 600 });
      initialFitDoneRef.current = true;
    }
  }, [mapReady, entryCoords, trip.id, trip.startLatitude, trip.startLongitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || initialFitDoneRef.current || entryCoords.length > 0) {
      return;
    }
    if (!currentPosition) return;
    map.easeTo({
      center: [currentPosition.longitude, currentPosition.latitude],
      zoom: 12,
      duration: 600,
    });
    initialFitDoneRef.current = true;
  }, [mapReady, currentPosition, entryCoords.length]);

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
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#070f18]">
      <DevComponentLabel name="TripLogMap" className="absolute left-2 top-2 z-10" />
      <div ref={containerRef} className={cn("sailing-map", mapClassName)} />
      {mapReady ? (
        <SailingMapControlStack
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocate={handleLocate}
          onExpand={allowFullscreen ? () => setFullscreenOpen(true) : undefined}
        />
      ) : null}
      {mapError ? <p className="m-0 border-t border-[#1a3044] px-4 py-2 text-xs text-[#b8c5d0]">{mapError}</p> : null}
    </div>
  );

  return (
    <>
      {allowFullscreen ? (
        <div className="overflow-hidden rounded-[1.5rem] border border-[#1a3044]">{mapShell}</div>
      ) : (
        mapShell
      )}
      {allowFullscreen && fullscreenOpen ? (
        <SailingMapFullscreenModal title="Trip map" onClose={() => setFullscreenOpen(false)}>
          <DevComponentLabel name="TripLogMap" />

          <TripLogMap trip={trip} entries={entries} mapClassName="h-full w-full" allowFullscreen={false} />
        </SailingMapFullscreenModal>
      ) : null}
    </>
  );
}
