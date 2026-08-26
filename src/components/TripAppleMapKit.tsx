import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Leg, LogEntry, Trip } from "../domain/logbook";
import type { MapCoordinate } from "../lib/native/logmaster-apple-map";
import { LogmasterAppleMap } from "../lib/native/logmaster-apple-map";
import { readMapPassThroughZones } from "../lib/native/apple-map-layout";
import { DEV_FALLBACK_POSITION, getCurrentPosition, subscribeToDevicePosition } from "../lib/logbook-context";
import { buildLegEntryPointsGeoJson, buildLegTrackGeoJson, resolveTripLogMapViewport } from "../lib/logbook-map-geo";
import { cn } from "../lib/cn";
import { DevComponentLabel } from "./DevComponentLabel";

export type TripAppleMapKitHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  locate: () => void;
};

type TripAppleMapKitProps = {
  trip: Trip;
  entries: LogEntry[];
  legs?: Leg[];
  focusEntryId?: string | null;
  mapClassName?: string;
  showControls?: boolean;
  showCurrentPosition?: boolean;
  interactive?: boolean;
  embedded?: boolean;
  controlStackClassName?: string;
};

function coordinatesFromGeoJson(collection: GeoJSON.FeatureCollection): MapCoordinate[] {
  return collection.features.flatMap((feature) => {
    if (feature.geometry?.type !== "Point") return [];
    const [longitude, latitude] = feature.geometry.coordinates;
    if (typeof latitude !== "number" || typeof longitude !== "number") return [];
    return [{ latitude, longitude }];
  });
}

function trackCoordinatesFromGeoJson(collection: GeoJSON.FeatureCollection): MapCoordinate[] {
  return collection.features.flatMap((feature) => {
    if (feature.geometry?.type !== "LineString") return [];
    return feature.geometry.coordinates.flatMap(([longitude, latitude]) => {
      if (typeof latitude !== "number" || typeof longitude !== "number") return [];
      return [{ latitude, longitude }];
    });
  });
}

export const TripAppleMapKit = forwardRef<TripAppleMapKitHandle, TripAppleMapKitProps>(function TripAppleMapKit(
  {
  trip,
  entries,
  legs = [],
  focusEntryId = null,
  mapClassName,
  showControls: _showControls = true,
  showCurrentPosition = true,
  interactive = true,
  embedded = false,
  controlStackClassName: _controlStackClassName,
}: TripAppleMapKitProps,
  ref,
) {
  const mapId = useId().replace(/:/g, "");
  const initialFitDoneRef = useRef(false);
  const userControlledViewportRef = useRef(false);
  const currentPositionRef = useRef<MapCoordinate | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const legTrackGeoJson = useMemo(() => buildLegTrackGeoJson(entries, legs), [entries, legs]);
  const legEntryGeoJson = useMemo(() => buildLegEntryPointsGeoJson(entries, legs), [entries, legs]);
  const viewportTarget = useMemo(
    () => resolveTripLogMapViewport(trip, entries, { focusEntryId }),
    [trip, entries, focusEntryId],
  );

  const shouldFollowUser = interactive && showCurrentPosition && viewportTarget.kind === "current-location";

  const syncUserLocation = useCallback(async () => {
    if (!mapReady) return;
    await LogmasterAppleMap.setShowsUserLocation({
      mapId,
      show: showCurrentPosition,
      follow: shouldFollowUser && !userControlledViewportRef.current,
    });
  }, [mapId, mapReady, shouldFollowUser, showCurrentPosition]);

  const syncInteractionChrome = useCallback(async () => {
    if (!mapReady || !interactive) return;
    await LogmasterAppleMap.setLayout({
      mapId,
      passThrough: readMapPassThroughZones(),
    });
  }, [interactive, mapId, mapReady]);

  const syncOverlays = useCallback(async () => {
    if (!mapReady) return;
    await LogmasterAppleMap.setOverlays({
      mapId,
      track: trackCoordinatesFromGeoJson(legTrackGeoJson),
      entryPoints: coordinatesFromGeoJson(legEntryGeoJson),
    });
  }, [mapId, mapReady, legTrackGeoJson, legEntryGeoJson]);

  const syncViewport = useCallback(async () => {
    if (!mapReady || initialFitDoneRef.current) return;

    if (viewportTarget.kind === "current-location") {
      if (shouldFollowUser) {
        await syncUserLocation();
        initialFitDoneRef.current = true;
        return;
      }
      const position = currentPositionRef.current;
      if (!position) return;
      await LogmasterAppleMap.setCamera({
        mapId,
        center: position,
        spanLatitude: 0.06,
        spanLongitude: 0.06,
      });
      initialFitDoneRef.current = true;
      return;
    }

    if (viewportTarget.kind === "point") {
      await LogmasterAppleMap.setCamera({
        mapId,
        center: {
          latitude: viewportTarget.point.latitude,
          longitude: viewportTarget.point.longitude,
        },
        spanLatitude: 0.06,
        spanLongitude: 0.06,
      });
      initialFitDoneRef.current = true;
      return;
    }

    if (viewportTarget.points.length === 0) return;

    await LogmasterAppleMap.fitCoordinates({
      mapId,
      coordinates: viewportTarget.points.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
      padding: embedded ? 24 : 48,
    });
    initialFitDoneRef.current = true;
  }, [embedded, mapId, mapReady, shouldFollowUser, syncUserLocation, viewportTarget]);

  const bootstrapPosition = useCallback(async () => {
    const gps = await getCurrentPosition({ force: true });
    currentPositionRef.current = {
      latitude: gps.latitude ?? DEV_FALLBACK_POSITION.latitude,
      longitude: gps.longitude ?? DEV_FALLBACK_POSITION.longitude,
    };
    if (!initialFitDoneRef.current) {
      await syncViewport();
    }
  }, [syncViewport]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await LogmasterAppleMap.create({ mapId, interactive });
      if (cancelled) return;
      await LogmasterAppleMap.setVisible({ mapId, visible: true });
      await LogmasterAppleMap.setShowsUserLocation({
        mapId,
        show: showCurrentPosition,
        follow: shouldFollowUser,
      });
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      setMapReady(false);
      void LogmasterAppleMap.destroy({ mapId });
    };
  }, [interactive, mapId, shouldFollowUser, showCurrentPosition]);

  useEffect(() => {
    void syncUserLocation();
  }, [syncUserLocation]);

  useEffect(() => {
    initialFitDoneRef.current = false;
    userControlledViewportRef.current = false;
  }, [trip.id, focusEntryId, viewportTarget.kind]);

  useEffect(() => {
    if (!mapReady) return;
    void bootstrapPosition();
  }, [bootstrapPosition, mapReady]);

  useEffect(() => {
    void syncOverlays();
  }, [syncOverlays]);

  useEffect(() => {
    void syncViewport();
  }, [syncViewport]);

  useEffect(() => {
    if (!mapReady) return;

    return subscribeToDevicePosition((position) => {
      if (position.latitude == null || position.longitude == null) return;
      currentPositionRef.current = {
        latitude: position.latitude,
        longitude: position.longitude,
      };
      if (viewportTarget.kind === "current-location" && !initialFitDoneRef.current) {
        void syncViewport();
      }
    });
  }, [mapReady, syncViewport, viewportTarget.kind]);

  useEffect(() => {
    if (!mapReady || !interactive) return;

    let syncFrame = 0;
    const syncChrome = () => {
      cancelAnimationFrame(syncFrame);
      syncFrame = requestAnimationFrame(() => {
        void syncInteractionChrome();
      });
    };

    const observer = new ResizeObserver(syncChrome);
    observer.observe(document.documentElement);
    const sheet = document.querySelector("[data-trip-bottom-sheet]");
    const header = document.querySelector("header");
    if (sheet) observer.observe(sheet);
    if (header) observer.observe(header);
    for (const node of document.querySelectorAll("[data-map-touch-zone], [data-trip-operational-controls]")) {
      observer.observe(node);
    }
    window.addEventListener("resize", syncChrome, { passive: true });
    const mutationObserver = new MutationObserver(syncChrome);
    mutationObserver.observe(document.body, { childList: true });
    syncChrome();

    return () => {
      cancelAnimationFrame(syncFrame);
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", syncChrome);
    };
  }, [interactive, mapReady, syncInteractionChrome]);

  useEffect(() => {
    if (!mapReady || !interactive) return;
    void syncInteractionChrome();
  }, [interactive, mapReady, syncInteractionChrome]);

  const releaseFollowForManualViewport = useCallback(async () => {
    userControlledViewportRef.current = true;
    if (!showCurrentPosition) return;
    await LogmasterAppleMap.setShowsUserLocation({
      mapId,
      show: true,
      follow: false,
    });
  }, [mapId, showCurrentPosition]);

  const handleZoomIn = useCallback(() => {
    void (async () => {
      await releaseFollowForManualViewport();
      await LogmasterAppleMap.adjustZoom({ mapId, factor: 1.35 });
    })();
  }, [mapId, releaseFollowForManualViewport]);

  const handleZoomOut = useCallback(() => {
    void (async () => {
      await releaseFollowForManualViewport();
      await LogmasterAppleMap.adjustZoom({ mapId, factor: 1 / 1.35 });
    })();
  }, [mapId, releaseFollowForManualViewport]);

  const handleLocate = useCallback(() => {
    void (async () => {
      const gps = await getCurrentPosition({ force: true });
      currentPositionRef.current = {
        latitude: gps.latitude ?? DEV_FALLBACK_POSITION.latitude,
        longitude: gps.longitude ?? DEV_FALLBACK_POSITION.longitude,
      };
      if (shouldFollowUser) {
        userControlledViewportRef.current = false;
        await LogmasterAppleMap.setShowsUserLocation({
          mapId,
          show: true,
          follow: true,
        });
        return;
      }
      userControlledViewportRef.current = true;
      await LogmasterAppleMap.setCamera({
        mapId,
        center: currentPositionRef.current,
        spanLatitude: 0.04,
        spanLongitude: 0.04,
      });
    })();
  }, [mapId, shouldFollowUser]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      locate: handleLocate,
    }),
    [handleZoomIn, handleZoomOut, handleLocate],
  );

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-transparent">
      {!embedded ? <DevComponentLabel name="TripAppleMapKit" className="absolute left-2 top-2 z-10" /> : null}
      <div className={cn("pointer-events-none bg-transparent", mapClassName)} aria-hidden />
    </div>
  );
});
