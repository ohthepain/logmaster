import { Map, Route as RouteIcon, RotateCw, Sailboat } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Leg, LogEntry, Media, Trip } from "../domain/logbook";
import type { TripTrack } from "../domain/trip-track";
import type { TripDetailCoverDisplay } from "../lib/trip-display";
import type { TripMapHandle } from "../lib/trip-map-handle";
import type { MapWaypointPickConfig } from "../lib/map-waypoint-pick";
import { isWaypointMapInteractionActive } from "../lib/map-waypoint-pick";
import { retripSourceElapsedMs, retripSourceTimeMs as mapRetripSourceTimeMs } from "../lib/dev-trip-retrip";
import { getNativePlatform } from "../lib/platform";
import { useAppOptionsStore } from "../stores/app-options";
import { useLogbookStore } from "../stores/logbook";
import { routeWaypointsForRoute, useRoutesStore } from "../stores/routes";
import { DevComponentLabel } from "./DevComponentLabel";
import { SailingMapControlStack } from "./SailingMapControlStack";
import { SailingMapFullscreenModal } from "./SailingMapFullscreenModal";
import { SailingMapLayerPanel } from "./SailingMapLayerPanel";
import { TripLogMap } from "./TripLogMap";
import { TripOperationalStatus } from "./TripOperationalStatus";
import { TripPlaybackInfoPanel } from "./TripPlaybackInfoPanel";
import { TripPlaybackOverlay } from "./TripPlaybackOverlay";
import { TripMapChromeButton } from "./TripMapChromeButton";
import { TripMapEditMenu } from "./TripMapEditMenu";
import { PlannedRoutePickerModal } from "./RouteCopyModals";
import { cn } from "../lib/cn";
import { tripPlaybackPositionAt, tripPlaybackRange } from "../lib/trip-playback";

export type CompletedTripPanel = "map" | "log";

type TripDetailHeroProps = {
  trip: Trip;
  cover: TripDetailCoverDisplay;
  mapEntries: LogEntry[];
  mapLegs: Leg[];
  mapTracks?: TripTrack[];
  mediaByEntry: Map<string, Media[]>;
  busy: boolean;
  selectedEntryId?: string | null;
  onEntrySelect?: (entryId: string) => void;
  completedTripPanel?: CompletedTripPanel;
  onCompletedTripPanelChange?: (panel: CompletedTripPanel) => void;
  onEditCoverClick: () => void;
  uploadMediaInputId: string;
  uploadingMedia?: boolean;
  onLogEntryClick?: () => void;
  onAddWaypointClick?: () => void;
  onEditWaypointsClick?: () => void;
  waypointPick?: MapWaypointPickConfig;
  onReplayTestClick?: () => void;
  onInitialMapViewportSettled?: () => void;
};

export const TripDetailHero = forwardRef<TripMapHandle, TripDetailHeroProps>(function TripDetailHero(
  {
  trip,
  cover,
  mapEntries,
  mapLegs,
  mapTracks = [],
  mediaByEntry,
  busy,
  selectedEntryId = null,
  onEntrySelect,
  completedTripPanel = "map",
  onCompletedTripPanelChange,
  onEditCoverClick,
  uploadMediaInputId,
  uploadingMedia = false,
  onLogEntryClick,
  onAddWaypointClick,
  onEditWaypointsClick,
  waypointPick,
  onReplayTestClick,
  onInitialMapViewportSettled,
}: TripDetailHeroProps,
  ref,
) {
  const isActiveTrip = trip.status === "IN_PROGRESS" || trip.status === "PLANNED";
  const isPlayback = trip.status === "COMPLETED";
  const recordingTripId = useAppOptionsStore((state) => state.recordingTripId);
  const devTripRetrip = useAppOptionsStore((state) => state.devTripRetrip);
  const pauseDevTripRetrip = useAppOptionsStore((state) => state.pauseDevTripRetrip);
  const resumeDevTripRetrip = useAppOptionsStore((state) => state.resumeDevTripRetrip);
  const setDevTripRetripTimescale = useAppOptionsStore((state) => state.setDevTripRetripTimescale);
  const stopDevTripRetrip = useAppOptionsStore((state) => state.stopDevTripRetrip);
  const allTrips = useLogbookStore((state) => state.trips);
  const allEntries = useLogbookStore((state) => state.entries);
  const allTracks = useLogbookStore((state) => state.tracks);
  const mapDataLayerToggles = useAppOptionsStore((state) => state.mapDataLayerToggles);
  const setMapDataLayerToggles = useAppOptionsStore((state) => state.setMapDataLayerToggles);
  const mapLogEntryLayerToggles = useAppOptionsStore((state) => state.mapLogEntryLayerToggles);
  const setMapLogEntryLayerToggles = useAppOptionsStore((state) => state.setMapLogEntryLayerToggles);
  const showCurrentPosition =
    (isActiveTrip && recordingTripId === trip.id) ||
    (isActiveTrip && devTripRetrip != null) ||
    (isPlayback &&
      devTripRetrip != null &&
      devTripRetrip.sourceTripId === trip.id);
  const showInteractiveMap = isActiveTrip || isPlayback || cover.kind === "map";
  const showPhoto = !showInteractiveMap && cover.kind === "photo" && cover.photoUrl;
  const waypointMapInteractionActive = isWaypointMapInteractionActive(waypointPick);
  const showOperationalOverlay = isActiveTrip && !waypointMapInteractionActive;
  const useExternalIosMapControls = getNativePlatform() === "ios" && showInteractiveMap;
  const showMapDataLayers = getNativePlatform() !== "ios";
  const mapRef = useRef<TripMapHandle>(null);
  const fullscreenMapRef = useRef<TripMapHandle>(null);
  const [mapFullscreenOpen, setMapFullscreenOpen] = useState(false);
  const [plannedRoutePickerOpen, setPlannedRoutePickerOpen] = useState(false);
  const [overlayRouteId, setOverlayRouteId] = useState<string | null>(null);
  const routes = useRoutesStore((state) => state.routes);
  const routeWaypoints = useRoutesStore((state) => state.waypoints);
  const plannedRouteWaypoints = useMemo(
    () =>
      overlayRouteId
        ? routeWaypointsForRoute(overlayRouteId, routeWaypoints)
        : [],
    [overlayRouteId, routeWaypoints],
  );
  const playbackRange = useMemo(
    () => tripPlaybackRange(trip, mapEntries, mapTracks),
    [mapEntries, mapTracks, trip],
  );

  useEffect(() => {
    void useRoutesStore.getState().load();
  }, []);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(playbackRange.startMs);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [liveTimeMs, setLiveTimeMs] = useState(() => Date.now());
  const [retripNowMs, setRetripNowMs] = useState(() => Date.now());

  const retripSourceTrip = useMemo(
    () =>
      devTripRetrip
        ? allTrips.find((item) => item.id === devTripRetrip.sourceTripId) ?? null
        : null,
    [allTrips, devTripRetrip],
  );
  const retripSourceEntries = useMemo(
    () =>
      retripSourceTrip
        ? allEntries.filter(
            (entry) => entry.tripId === retripSourceTrip.id && !entry.deleted,
          )
        : [],
    [allEntries, retripSourceTrip],
  );
  const retripSourceTracks = useMemo(
    () =>
      retripSourceTrip
        ? allTracks.filter((track) => track.tripId === retripSourceTrip.id)
        : [],
    [allTracks, retripSourceTrip],
  );
  const retripInfoTimeMs = useMemo(() => {
    if (!devTripRetrip || !retripSourceTrip) return null;
    const elapsedMs = retripSourceElapsedMs(devTripRetrip, retripNowMs);
    return mapRetripSourceTimeMs(retripSourceTrip, elapsedMs);
  }, [devTripRetrip, retripNowMs, retripSourceTrip]);

  const handleRetripPauseToggle = useCallback(() => {
    if (!devTripRetrip) return;
    if (devTripRetrip.paused) resumeDevTripRetrip();
    else pauseDevTripRetrip();
  }, [devTripRetrip, pauseDevTripRetrip, resumeDevTripRetrip]);

  const playbackPosition = useMemo(
    () =>
      isPlayback
        ? tripPlaybackPositionAt(trip.id, mapEntries, playbackTimeMs, mapTracks)
        : null,
    [isPlayback, mapEntries, mapTracks, playbackTimeMs, trip.id],
  );

  const showPlaybackOverlay = isPlayback && completedTripPanel === "map";
  const infoTimeMs = devTripRetrip && retripInfoTimeMs != null
    ? retripInfoTimeMs
    : isPlayback
      ? playbackTimeMs
      : liveTimeMs;
  const infoTripId = devTripRetrip && retripSourceTrip ? retripSourceTrip.id : trip.id;
  const infoTracks = devTripRetrip && retripSourceTrip ? retripSourceTracks : mapTracks;
  const infoEntries = devTripRetrip && retripSourceTrip ? retripSourceEntries : mapEntries;
  const infoPosition = useMemo(
    () =>
      isPlayback && !devTripRetrip
        ? playbackPosition
        : tripPlaybackPositionAt(infoTripId, infoEntries, infoTimeMs, infoTracks),
    [
      devTripRetrip,
      infoEntries,
      infoTimeMs,
      infoTracks,
      infoTripId,
      isPlayback,
      playbackPosition,
    ],
  );

  const mapPlaybackPosition = devTripRetrip ? infoPosition : playbackPosition;

  useEffect(() => {
    setPlaybackTimeMs(playbackRange.startMs);
    setPlaybackPlaying(false);
  }, [playbackRange.startMs, trip.id]);

  useEffect(() => {
    if (!isActiveTrip) return;
    setLiveTimeMs(Date.now());
    const intervalId = window.setInterval(() => setLiveTimeMs(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, [isActiveTrip, trip.id]);

  useEffect(() => {
    if (!devTripRetrip) return;
    setRetripNowMs(Date.now());
    const intervalId = window.setInterval(() => setRetripNowMs(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [devTripRetrip]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => mapRef.current?.zoomIn(),
      zoomOut: () => mapRef.current?.zoomOut(),
      locate: () => mapRef.current?.locate(),
      captureMapSnapshot: async () =>
        (await mapRef.current?.captureMapSnapshot()) ?? null,
    }),
    [],
  );

  return (
    <section
      className={
        getNativePlatform() === "ios" && showInteractiveMap
          ? "absolute inset-0 isolate overflow-hidden bg-transparent"
          : "absolute inset-0 isolate overflow-hidden bg-[var(--chip-bg)]"
      }
    >
      <DevComponentLabel name="TripDetailHero" className="absolute left-3 top-14 z-20 sm:left-4" />

      {showInteractiveMap ? (
        <div className="absolute inset-0">
          <TripLogMap
            ref={mapRef}
            trip={trip}
            entries={mapEntries}
            legs={mapLegs}
            tracks={mapTracks}
            selectedEntryId={selectedEntryId}
            onEntrySelect={onEntrySelect}
            mediaByEntry={mediaByEntry}
            mapClassName="absolute inset-0 size-full"
            allowFullscreen={showInteractiveMap}
            showControls={!useExternalIosMapControls}
            showCurrentPosition={showCurrentPosition}
            interactive={isActiveTrip || isPlayback}
            embedded
            showSeamarks={isActiveTrip || isPlayback}
            playbackPosition={mapPlaybackPosition}
            playbackMode={isPlayback}
            playbackPlaying={playbackPlaying}
            boatIconId={trip.boatIconId}
            plannedRouteWaypoints={plannedRouteWaypoints}
            waypointPick={waypointPick}
            onInitialViewportSettled={onInitialMapViewportSettled}
          />
        </div>
      ) : showPhoto ? (
        <img src={cover.photoUrl!} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,#1e3a5f_0%,#0f172a_55%,#020617_100%)] text-white/35">
          <Sailboat className="size-24" strokeWidth={1.1} />
        </div>
      )}

      {showPhoto ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />
      ) : null}

      {useExternalIosMapControls ? (
        <SailingMapControlStack
          className={cn(
            showPlaybackOverlay &&
              "top-auto bottom-[calc(13.5rem+env(safe-area-inset-bottom,0px))] translate-y-0",
          )}
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onLocate={() => mapRef.current?.locate()}
          locateLabel={isPlayback ? "Center on boat position" : undefined}
          layers={
            showMapDataLayers ? (
              <SailingMapLayerPanel
                toggles={mapDataLayerToggles}
                onChange={setMapDataLayerToggles}
                logEntryToggles={mapLogEntryLayerToggles}
                onLogEntryChange={setMapLogEntryLayerToggles}
                aisPlaybackBlocked={isPlayback && playbackPlaying}
                aisSavedTripHint={isPlayback && !playbackPlaying}
              />
            ) : undefined
          }
          onExpand={showInteractiveMap ? () => setMapFullscreenOpen(true) : undefined}
        />
      ) : null}

      {mapFullscreenOpen ? (
        <SailingMapFullscreenModal title="Trip map" onClose={() => setMapFullscreenOpen(false)}>
          <div className="relative h-full min-h-0">
            <TripLogMap
              ref={fullscreenMapRef}
              trip={trip}
              entries={mapEntries}
              legs={mapLegs}
              tracks={mapTracks}
              selectedEntryId={selectedEntryId}
              onEntrySelect={onEntrySelect}
              mediaByEntry={mediaByEntry}
              mapClassName="absolute inset-0 size-full"
              allowFullscreen={false}
              showControls={false}
              showCurrentPosition={showCurrentPosition}
              interactive={isActiveTrip || isPlayback}
              embedded
              showSeamarks={isActiveTrip || isPlayback}
              playbackPosition={mapPlaybackPosition}
              playbackMode={isPlayback}
              playbackPlaying={playbackPlaying}
              boatIconId={trip.boatIconId}
              plannedRouteWaypoints={plannedRouteWaypoints}
              waypointPick={waypointPick}
            />
            <SailingMapControlStack
              onZoomIn={() => fullscreenMapRef.current?.zoomIn()}
              onZoomOut={() => fullscreenMapRef.current?.zoomOut()}
              onLocate={() => fullscreenMapRef.current?.locate()}
              locateLabel={isPlayback ? "Center on boat position" : undefined}
              layers={
                showMapDataLayers ? (
                  <SailingMapLayerPanel
                    toggles={mapDataLayerToggles}
                    onChange={setMapDataLayerToggles}
                    logEntryToggles={mapLogEntryLayerToggles}
                    onLogEntryChange={setMapLogEntryLayerToggles}
                    aisPlaybackBlocked={isPlayback && playbackPlaying}
                    aisSavedTripHint={isPlayback && !playbackPlaying}
                  />
                ) : undefined
              }
            />
          </div>
        </SailingMapFullscreenModal>
      ) : null}

      {showPlaybackOverlay && !waypointMapInteractionActive ? (
        <TripPlaybackOverlay
          trip={trip}
          entries={mapEntries}
          legs={mapLegs}
          tracks={mapTracks}
          mediaByEntry={mediaByEntry}
          currentTimeMs={playbackTimeMs}
          onCurrentTimeChange={setPlaybackTimeMs}
          onPlayingChange={setPlaybackPlaying}
          onShowLogEntries={
            onCompletedTripPanelChange ? () => onCompletedTripPanelChange('log') : undefined
          }
        />
      ) : null}

      {isPlayback && completedTripPanel === "log" && onCompletedTripPanelChange ? (
        <section
          data-map-touch-zone
          aria-label="Completed trip log"
          className="ios-map-touch-target pointer-events-auto absolute inset-x-0 bottom-0 z-30 border-t border-white/25 bg-black/65 px-3 py-3 text-white shadow-[0_-12px_36px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:px-4"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 10px)" }}
        >
          <div className="mx-auto grid max-w-4xl grid-cols-[1fr_auto_1fr] items-center">
            <button
              type="button"
              data-map-touch-zone
              onClick={() => onCompletedTripPanelChange("map")}
              className="ios-map-touch-target inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              aria-label="Map and playback"
            >
              <Map className="size-4" />
            </button>
          </div>
        </section>
      ) : null}

      {showOperationalOverlay ? (
        <TripOperationalStatus
          tripId={trip.id}
          trip={trip}
          entries={mapEntries}
          onLogEntryClick={onLogEntryClick}
          logEntryDisabled={busy}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex flex-col items-start gap-2 px-3 sm:px-4">
        {!waypointMapInteractionActive ? (
        <div className="pointer-events-auto flex justify-start gap-2">
          <TripMapEditMenu
            disabled={busy}
            uploading={uploadingMedia}
            onEditCover={onEditCoverClick}
            onAddWaypoint={onAddWaypointClick}
            onEditWaypoints={onEditWaypointsClick}
            uploadInputId={uploadMediaInputId}
          />
          {showInteractiveMap ? (
            <TripMapChromeButton
              label={overlayRouteId ? "Change planned route overlay" : "Show planned route"}
              onClick={() => setPlannedRoutePickerOpen(true)}
              disabled={busy}
              active={overlayRouteId != null}
              tooltipSide="bottom"
            >
              <RouteIcon className="size-4" />
            </TripMapChromeButton>
          ) : null}
          {onReplayTestClick ? (
            <TripMapChromeButton
              label="Start auto-test replay"
              onClick={onReplayTestClick}
              disabled={busy}
              tooltipSide="bottom"
            >
              <RotateCw className="size-4" />
            </TripMapChromeButton>
          ) : null}
        </div>
        ) : null}
        {showInteractiveMap && !waypointMapInteractionActive ? (
          <TripPlaybackInfoPanel
            tripId={infoTripId}
            tracks={infoTracks}
            entries={infoEntries}
            currentTimeMs={infoTimeMs}
            playbackPosition={infoPosition}
            retrip={
              devTripRetrip
                ? {
                    timescale: devTripRetrip.timescale,
                    paused: devTripRetrip.paused,
                    onPauseToggle: handleRetripPauseToggle,
                    onTimescaleChange: setDevTripRetripTimescale,
                    onStop: stopDevTripRetrip,
                  }
                : undefined
            }
          />
        ) : null}
      </div>

      <PlannedRoutePickerModal
        open={plannedRoutePickerOpen}
        routes={routes}
        selectedRouteId={overlayRouteId}
        onClose={() => setPlannedRoutePickerOpen(false)}
        onSelect={(routeId) => {
          setOverlayRouteId(routeId);
          setPlannedRoutePickerOpen(false);
        }}
      />
    </section>
  );
});
