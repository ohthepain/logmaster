import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, Trip } from "../domain/logbook";
import { DEV_FALLBACK_POSITION, subscribeToDevicePosition } from "../lib/logbook-context";
import { logEntryMapPoints, mapBrandColor, mapPointsToBounds, resolveTripLogMapViewport } from "../lib/logbook-map-geo";
import {
  addOpenSeaMapSeamarkOverlay,
  bindSeamarkTileRefreshOnViewChange,
  finalizeSailingMapLayers,
  guardSailingMapAgainstTerrain,
  loadSailingMapStyle,
  scheduleSeamarkTileRefresh,
} from "../lib/maplibre-sailing-map-setup";
import { applySailingLogMapTheme, sailingMapOverlayPaint, SailingMapColors } from "../lib/maplibre-sailing-theme";
import { getGeoJsonSource } from "../lib/maplibre-source";
import { defaultRasterMapId } from "../lib/map-styles";
import { centerMapOnCurrentLocation, centerMapOnPoint } from "../lib/sailing-map-viewport";
import { mapTilerTransformRequest } from "../lib/tiles";
import { cn } from "../lib/cn";
import { DevComponentLabel } from "./DevComponentLabel";
import { SailingMapControlStack } from "./SailingMapControlStack";
import { SailingMapFullscreenModal } from "./SailingMapFullscreenModal";

type TripLogMapProps = {
  trip: Trip;
  entries: LogEntry[];
  focusEntryId?: string | null;
  mapClassName?: string;
  allowFullscreen?: boolean;
  showControls?: boolean;
  showCurrentPosition?: boolean;
  interactive?: boolean;
  embedded?: boolean;
  showSeamarks?: boolean;
};

type LngLat = { longitude: number; latitude: number };

const ENTRY_SOURCE = "trip-log-entries";
const TRACK_SOURCE = "trip-log-track";
const CURRENT_SOURCE = "trip-current-position";

export function TripLogMap({
  trip,
  entries,
  focusEntryId = null,
  mapClassName = "h-56 w-full sm:h-64",
  allowFullscreen = true,
  showControls = true,
  showCurrentPosition = true,
  interactive = true,
  embedded = false,
  showSeamarks = true,
}: TripLogMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initialFitDoneRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<LngLat | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const entryCoords = useMemo(() => logEntryMapPoints(entries), [entries]);
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
          zoom: 10,
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
          if (showSeamarks) {
            addOpenSeaMapSeamarkOverlay(map);
          }

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
          if (showSeamarks) {
            scheduleSeamarkTileRefresh(map);
            unbindSeamarkRefresh = bindSeamarkTileRefreshOnViewChange(map);
          }

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
  }, [interactive, showSeamarks]);

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
      features:
        showCurrentPosition && currentPosition
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
  }, [mapReady, entryCoords, currentPosition, showCurrentPosition]);

  useEffect(() => {
    initialFitDoneRef.current = false;
  }, [trip.id, focusEntryId, viewportTarget.kind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || initialFitDoneRef.current) return;

    if (viewportTarget.kind === "current-location") {
      if (!showCurrentPosition || !currentPosition) return;
      centerMapOnPoint(map, currentPosition, 14);
      initialFitDoneRef.current = true;
      return;
    }

    if (viewportTarget.kind === "point") {
      centerMapOnPoint(map, viewportTarget.point, 14);
      initialFitDoneRef.current = true;
      return;
    }

    const bounds = mapPointsToBounds(viewportTarget.points);
    if (bounds) {
      map.fitBounds(bounds, { padding: embedded ? 24 : 48, maxZoom: 14, duration: 600 });
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
        <SailingMapControlStack
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocate={handleLocate}
          onExpand={allowFullscreen ? () => setFullscreenOpen(true) : undefined}
        />
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

  if (embedded) {
    return mapShell;
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
      {allowFullscreen && fullscreenOpen ? (
        <SailingMapFullscreenModal title="Trip map" onClose={() => setFullscreenOpen(false)}>
          <DevComponentLabel name="TripLogMap" />

          <TripLogMap
            trip={trip}
            entries={entries}
            focusEntryId={focusEntryId}
            mapClassName="h-full w-full"
            allowFullscreen={false}
          />
        </SailingMapFullscreenModal>
      ) : null}
    </>
  );
}
