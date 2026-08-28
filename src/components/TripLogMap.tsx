import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, Leg, Trip, Media } from "../domain/logbook";
import { DEV_FALLBACK_POSITION, setDevPositionOverride, subscribeToDevicePosition } from "../lib/logbook-context";
import { isDevModeAvailable } from "../lib/dev-mode";
import { buildLegEntryPointsGeoJson, buildLegTrackGeoJson, mapBrandColor, mapPointsToBounds, resolveTripLogMapViewport, tripStartMapPoint } from "../lib/logbook-map-geo";
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
import { applySailingLogMapTheme, sailingMapLegTrackPaint, SailingMapColors } from "../lib/maplibre-sailing-theme";
import { addLogEntrySymbolLayer, syncLogEntryMapMarkerImages, syncLogEntryMapIconSelection } from "../lib/map-log-entry-icons";
import { getGeoJsonSource } from "../lib/maplibre-source";
import { defaultRasterMapId } from "../lib/map-styles";
import { centerMapOnCurrentLocation, juiceMapFocus, SAILING_MAP_EASE_MS, SAILING_MAP_FIT_MAX_ZOOM, SAILING_MAP_INITIAL_ZOOM } from "../lib/sailing-map-viewport";
import {
  fetchReversePlaceLookup,
  formatReversePlaceLabel,
} from "../lib/place-reverse-lookup-api";
import { mapTilerTransformRequest } from "../lib/tiles";
import { cn } from "../lib/cn";
import { getNativePlatform } from "../lib/platform";
import { useAppOptionsStore } from "../stores/app-options";
import { DevComponentLabel } from "./DevComponentLabel";
import { TripAppleMapKit  } from "./TripAppleMapKit";
import type {TripAppleMapKitHandle} from "./TripAppleMapKit";
import { SailingMapControlStack } from "./SailingMapControlStack";
import { SailingMapFullscreenModal } from "./SailingMapFullscreenModal";
import { SailingMapLayerPanel } from "./SailingMapLayerPanel";
import type { TripPlaybackPosition } from "../lib/trip-playback";
import {
  LogEntryMapMarkerHoverTarget,
  type MapEntryPreviewState,
} from "./LogEntryMapMarkerHoverTarget";

const ENTRY_LAYER = "trip-log-entry-icons";

type TripLogMapProps = {
  trip: Trip;
  entries: LogEntry[];
  legs?: Leg[];
  focusEntryId?: string | null;
  selectedEntryId?: string | null;
  onEntrySelect?: (entryId: string) => void;
  mediaByEntry?: Map<string, Media[]>;
  mapClassName?: string;
  allowFullscreen?: boolean;
  showControls?: boolean;
  showCurrentPosition?: boolean;
  interactive?: boolean;
  embedded?: boolean;
  showSeamarks?: boolean;
  controlStackClassName?: string;
  playbackPosition?: TripPlaybackPosition | null;
  playbackMode?: boolean;
};

type LngLat = { longitude: number; latitude: number };

const ENTRY_SOURCE = "trip-log-entries";
const TRACK_SOURCE = "trip-log-track";
const CURRENT_SOURCE = "trip-current-position";

function createPlaybackBoatMarkerElement() {
  const root = document.createElement("div");
  root.className = "trip-playback-boat-marker";
  root.setAttribute("aria-label", "Playback boat position");
  root.style.cssText = "width:36px;height:44px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));";
  root.innerHTML = `
    <div data-boat-heading style="width:30px;height:38px;transform-origin:50% 50%;transition:transform 80ms linear">
      <svg viewBox="0 0 30 38" width="30" height="38" aria-hidden="true">
        <path d="M15 2 26 27c-3.2 5.7-7 8.5-11 8.5S7.2 32.7 4 27L15 2Z" fill="#fff" stroke="#101010" stroke-width="2" stroke-linejoin="round"/>
        <path d="M15 7v23M8.5 26.5h13" fill="none" stroke="#eb4539" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>`;
  return root;
}

export const TripLogMap = forwardRef<TripAppleMapKitHandle, TripLogMapProps>(function TripLogMapView(props, ref) {
  if (getNativePlatform() === "ios" && props.embedded) {
    return (
      <TripAppleMapKit
        ref={ref}
        trip={props.trip}
        entries={props.entries}
        legs={props.legs}
        focusEntryId={props.focusEntryId}
        selectedEntryId={props.selectedEntryId}
        onEntrySelect={props.onEntrySelect}
        mediaByEntry={props.mediaByEntry}
        mapClassName={props.mapClassName}
        showControls={props.showControls}
        showCurrentPosition={props.showCurrentPosition}
        interactive={props.interactive}
        embedded={props.embedded}
        controlStackClassName={props.controlStackClassName}
        playbackPosition={props.playbackPosition}
      />
    );
  }

  return <TripLogMapMapLibre {...props} />;
});

function TripLogMapMapLibre({
  trip,
  entries,
  legs = [],
  focusEntryId = null,
  selectedEntryId = null,
  onEntrySelect,
  mediaByEntry,
  mapClassName = "h-56 w-full sm:h-64",
  allowFullscreen = true,
  showControls = true,
  showCurrentPosition = true,
  interactive = true,
  embedded = false,
  showSeamarks = true,
  controlStackClassName,
  playbackPosition = null,
  playbackMode = false,
}: TripLogMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onEntrySelectRef = useRef(onEntrySelect);
  const currentPositionMarkerRef = useRef<maplibregl.Marker | null>(null);
  const playbackBoatMarkerRef = useRef<maplibregl.Marker | null>(null);
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
  const [hoveredEntry, setHoveredEntry] = useState<MapEntryPreviewState | null>(null);

  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );
  const hoveredEntryRecord = hoveredEntry ? entriesById.get(hoveredEntry.entryId) ?? null : null;

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
    onEntrySelectRef.current = onEntrySelect;
  }, [onEntrySelect]);

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
          addLogEntrySymbolLayer(map, ENTRY_SOURCE, ENTRY_LAYER, selectedEntryId);

          map.on("click", ENTRY_LAYER, (event) => {
            const entryId = event.features?.[0]?.properties?.entryId;
            if (typeof entryId !== "string" || !entryId) return;
            setHoveredEntry(null);
            onEntrySelectRef.current?.(entryId);
          });
          map.on("mouseenter", ENTRY_LAYER, (event) => {
            if (!map) return;
            const entryId = event.features?.[0]?.properties?.entryId;
            if (typeof entryId !== "string" || !entryId) return;
            map.getCanvas().style.cursor = onEntrySelectRef.current ? "pointer" : "";
            setHoveredEntry({
              entryId,
              x: event.point.x,
              y: event.point.y,
              pinned: false,
            });
          });
          map.on("mousemove", ENTRY_LAYER, (event) => {
            const entryId = event.features?.[0]?.properties?.entryId;
            if (typeof entryId !== "string" || !entryId) return;
            setHoveredEntry({
              entryId,
              x: event.point.x,
              y: event.point.y,
              pinned: false,
            });
          });
          map.on("mouseleave", ENTRY_LAYER, () => {
            if (!map) return;
            map.getCanvas().style.cursor = "";
            setHoveredEntry(null);
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
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncLogEntryMapIconSelection(map, ENTRY_LAYER, selectedEntryId);
  }, [mapReady, selectedEntryId]);

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
    const currentSource = getGeoJsonSource(map, CURRENT_SOURCE);
    if (!trackSource || !currentSource) return;

    trackSource.setData(legTrackGeoJson);

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
  }, [mapReady, legTrackGeoJson, currentPosition, showCurrentPosition, devDraggablePosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const entrySource = getGeoJsonSource(map, ENTRY_SOURCE);
    if (!entrySource) return;

    let cancelled = false;
    void syncLogEntryMapMarkerImages(map, legEntryGeoJson).then(() => {
      if (cancelled) return;
      entrySource.setData(legEntryGeoJson);
    });

    return () => {
      cancelled = true;
    };
  }, [mapReady, legEntryGeoJson]);

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
    const map = mapRef.current;
    if (!map || !mapReady || !playbackPosition) {
      playbackBoatMarkerRef.current?.remove();
      playbackBoatMarkerRef.current = null;
      return;
    }

    let marker = playbackBoatMarkerRef.current;
    if (!marker) {
      marker = new maplibregl.Marker({
        element: createPlaybackBoatMarkerElement(),
        anchor: "center",
      });
      marker
        .setLngLat([playbackPosition.longitude, playbackPosition.latitude])
        .addTo(map);
      playbackBoatMarkerRef.current = marker;
    }
    marker.setLngLat([playbackPosition.longitude, playbackPosition.latitude]);
    const heading = marker.getElement().querySelector<HTMLElement>("[data-boat-heading]");
    if (heading) heading.style.transform = `rotate(${playbackPosition.heading}deg)`;

    return () => {
      // The next playback frame reuses the marker. Map teardown removes it separately.
    };
  }, [mapReady, playbackPosition]);

  useEffect(() => {
    initialFitDoneRef.current = false;
  }, [trip.id, focusEntryId, viewportTarget.kind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || initialFitDoneRef.current) return;

    if (viewportTarget.kind === "current-location") {
      if (showCurrentPosition) {
        if (!currentPosition) return;
        juiceMapFocus(map, currentPosition);
        initialFitDoneRef.current = true;
        return;
      }
      juiceMapFocus(
        map,
        tripStartMapPoint(trip) ?? {
          longitude: DEV_FALLBACK_POSITION.longitude,
          latitude: DEV_FALLBACK_POSITION.latitude,
        },
      );
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
    trip,
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
      {hoveredEntryRecord && hoveredEntry ? (
        <LogEntryMapMarkerHoverTarget
          entry={hoveredEntryRecord}
          media={mediaByEntry?.get(hoveredEntryRecord.id) ?? []}
          x={hoveredEntry.x}
          y={hoveredEntry.y}
          pinned={hoveredEntry.pinned}
          onSelect={onEntrySelectRef.current ?? undefined}
          onMediaClick={(entryId) => onEntrySelectRef.current?.(entryId)}
        />
      ) : null}
      {mapReady && showControls ? (
        <>
          <SailingMapControlStack
            className={controlStackClassName}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onLocate={playbackMode ? undefined : handleLocate}
            layers={playbackMode ? undefined : (
              <SailingMapLayerPanel
                toggles={mapDataLayerToggles}
                onChange={setMapDataLayerToggles}
              />
            )}
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
          selectedEntryId={selectedEntryId}
          onEntrySelect={onEntrySelect}
          mediaByEntry={mediaByEntry}
          mapClassName="h-full w-full"
          allowFullscreen={false}
          playbackPosition={playbackPosition}
          playbackMode={playbackMode}
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
