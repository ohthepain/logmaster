import { Map, Pencil, RotateCw, Sailboat } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Leg, LogEntry, Media, Trip } from "../domain/logbook";
import type { TripDetailCoverDisplay } from "../lib/trip-display";
import { getNativePlatform } from "../lib/platform";
import { useAppOptionsStore } from "../stores/app-options";
import { DevComponentLabel } from "./DevComponentLabel";
import { SailingMapControlStack } from "./SailingMapControlStack";
import { TripLogMap } from "./TripLogMap";
import type { TripAppleMapKitHandle } from "./TripAppleMapKit";
import { TripOperationalStatus } from "./TripOperationalStatus";
import { TripPlaybackOverlay } from "./TripPlaybackOverlay";
import { TripMapChromeButton } from "./TripMapChromeButton";
import { tripPlaybackPositionAt, tripPlaybackRange } from "../lib/trip-playback";

export type CompletedTripPanel = "map" | "log";

type TripDetailHeroProps = {
  trip: Trip;
  cover: TripDetailCoverDisplay;
  mapEntries: LogEntry[];
  mapLegs: Leg[];
  mediaByEntry: Map<string, Media[]>;
  busy: boolean;
  selectedEntryId?: string | null;
  onEntrySelect?: (entryId: string) => void;
  completedTripPanel?: CompletedTripPanel;
  onCompletedTripPanelChange?: (panel: CompletedTripPanel) => void;
  onEditCoverClick: () => void;
  onLogEntryClick?: () => void;
  onReplayTestClick?: () => void;
};

export function TripDetailHero({
  trip,
  cover,
  mapEntries,
  mapLegs,
  mediaByEntry,
  busy,
  selectedEntryId = null,
  onEntrySelect,
  completedTripPanel = "map",
  onCompletedTripPanelChange,
  onEditCoverClick,
  onLogEntryClick,
  onReplayTestClick,
}: TripDetailHeroProps) {
  const isActiveTrip = trip.status === "IN_PROGRESS" || trip.status === "PLANNED";
  const isPlayback = trip.status === "COMPLETED";
  const recordingTripId = useAppOptionsStore((state) => state.recordingTripId);
  const showCurrentPosition = isActiveTrip && recordingTripId === trip.id;
  const showInteractiveMap = isActiveTrip || isPlayback || cover.kind === "map";
  const showPhoto = !showInteractiveMap && cover.kind === "photo" && cover.photoUrl;
  const showOperationalOverlay = isActiveTrip;
  const useExternalIosMapControls = getNativePlatform() === "ios" && showInteractiveMap;
  const mapRef = useRef<TripAppleMapKitHandle>(null);
  const playbackRange = useMemo(() => tripPlaybackRange(trip, mapEntries), [mapEntries, trip]);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(playbackRange.startMs);
  const playbackPosition = useMemo(
    () => (isPlayback ? tripPlaybackPositionAt(mapEntries, playbackTimeMs) : null),
    [isPlayback, mapEntries, playbackTimeMs],
  );

  const showPlaybackOverlay = isPlayback && completedTripPanel === "map";

  useEffect(() => {
    setPlaybackTimeMs(playbackRange.startMs);
  }, [playbackRange.startMs, trip.id]);

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
            selectedEntryId={selectedEntryId}
            onEntrySelect={onEntrySelect}
            mediaByEntry={mediaByEntry}
            mapClassName="absolute inset-0 size-full"
            allowFullscreen={isActiveTrip}
            showControls={!useExternalIosMapControls}
            showCurrentPosition={showCurrentPosition}
            interactive={isActiveTrip || isPlayback}
            embedded
            showSeamarks={isActiveTrip}
            playbackPosition={playbackPosition}
            playbackMode={isPlayback}
            boatIconId={trip.boatIconId}
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
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onLocate={isPlayback ? undefined : () => mapRef.current?.locate()}
        />
      ) : null}

      {showPlaybackOverlay ? (
        <TripPlaybackOverlay
          trip={trip}
          entries={mapEntries}
          mediaByEntry={mediaByEntry}
          currentTimeMs={playbackTimeMs}
          onCurrentTimeChange={setPlaybackTimeMs}
          onShowLogEntries={onCompletedTripPanelChange ? () => onCompletedTripPanelChange("log") : undefined}
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

      <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-start gap-2 px-3 sm:px-4">
        <TripMapChromeButton label="Edit trip cover" onClick={onEditCoverClick} disabled={busy} tooltipSide="bottom">
          <Pencil className="size-4" />
        </TripMapChromeButton>
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
    </section>
  );
}
