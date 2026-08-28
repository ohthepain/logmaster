import { Link, useNavigate } from "@tanstack/react-router";
import { Check, RotateCw, Sailboat, Trash2, User } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DevComponentLabel } from "./DevComponentLabel";
import { DevTripReplayModal } from "./DevTripReplayModal";
import { LogEntryCreateModal } from "./LogEntryCreateModal";
import { LogEntryComposerModal } from "./LogEntryComposerModal";
import { Modal } from "./Modal";
import { TripCrewPickerModal } from "./TripCrewPickerModal";
import { TripCoverEditModal } from "./TripCoverEditModal";
import { TripDetailHero } from "./TripDetailHero";
import { TripDetailBottomSheet } from "./TripDetailBottomSheet";
import { TripRecordButton } from "./TripRecordButton";
import { TripLegSection } from "./TripLegSection";
import { NativeRecordingSettings } from "./NativeRecordingSettings";
import type { Media } from "../domain/logbook";
import type { CrewMember } from "../domain/crew";
import { fetchCrew } from "../lib/crew-api";
import { readImageFile } from "../lib/image-file";
import {
  DEV_TRIP_REPLAY_ENTRY_NOTE,
  DEV_TRIP_REPLAY_SOURCE,
  replayPositionAt,
  replaySourceEntries,
} from "../lib/dev-trip-replay";
import { isDevModeAvailable } from "../lib/dev-mode";
import { setDevPositionOverride } from "../lib/device-position";
import { formatDateTime, formatPosition } from "../lib/logbook-format";
import { tripDetailCoverDisplay, tripDisplayName } from "../lib/trip-display";
import { getNativePlatform } from "../lib/platform";
import { useIosNativeMapTouchPassthrough } from "../lib/native/ios-map-touch-passthrough";
import { useAppOptionsStore } from "../stores/app-options";
import { useLogbookStore, triggerLogbookSyncRetry } from "../stores/logbook";

type TripDetailPageProps = {
  tripId: string;
  startFromLiveActivity?: boolean;
};

export function TripDetailPage({ tripId, startFromLiveActivity = false }: TripDetailPageProps) {
  const navigate = useNavigate();
  const store = useLogbookStore();
  const trip = store.trips.find((item) => item.id === tripId) ?? null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const [busy, setBusy] = useState(false);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [crewPickerOpen, setCrewPickerOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [createEntryOpen, setCreateEntryOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [coverEditOpen, setCoverEditOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const liveActivityStartHandledRef = useRef(false);

  useEffect(() => {
    void useLogbookStore.getState().load();
  }, []);

  useEffect(() => {
    useLogbookStore.getState().selectTrip(tripId);
  }, [tripId]);

  useEffect(() => {
    if (!startFromLiveActivity || !store.booted || !trip) return;
    if (liveActivityStartHandledRef.current) return;
    liveActivityStartHandledRef.current = true;

    // Clear the command URL first so an app reload cannot execute it twice.
    void navigate({
      to: "/trips/$tripId",
      params: { tripId },
      search: { liveActivity: undefined },
      replace: true,
    });

    void (async () => {
      setBusy(true);
      try {
        const wasPlanned = trip.status === "PLANNED";
        if (wasPlanned) {
          await useLogbookStore.getState().addEntry({
            tripId,
            type: "START_TRIP",
          });
        }
        const current = useLogbookStore
          .getState()
          .trips.find((item) => item.id === tripId);
        if (current?.status === "IN_PROGRESS") {
          useAppOptionsStore.getState().setRecordingTripId(tripId);
        }
        toast.success(wasPlanned ? "Trip started" : "Recording resumed");
      } catch (error) {
        liveActivityStartHandledRef.current = false;
        toast.error(
          error instanceof Error ? error.message : "Failed to start trip",
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [navigate, startFromLiveActivity, store.booted, trip, tripId]);

  useEffect(() => {
    void fetchCrew()
      .then((payload) => {
        setCrewMembers(payload.members);
        triggerLogbookSyncRetry();
      })
      .catch((error: unknown) => {
        if (error instanceof Error && /\((401|403)\)/.test(error.message)) return;
        toast.error("Could not load your crew");
      });
  }, [tripId]);

  useEffect(() => {
    if (getNativePlatform() !== "ios") return;
    const { style: htmlStyle } = document.documentElement;
    const { style: bodyStyle } = document.body;
    const previousHtmlBackground = htmlStyle.backgroundColor;
    const previousBodyBackground = bodyStyle.backgroundColor;
    htmlStyle.backgroundColor = "transparent";
    bodyStyle.backgroundColor = "transparent";
    return () => {
      htmlStyle.backgroundColor = previousHtmlBackground;
      bodyStyle.backgroundColor = previousBodyBackground;
    };
  }, []);

  const tripLegs = useMemo(
    () => store.legs.filter((leg) => leg.tripId === tripId),
    [store.legs, tripId],
  );

  const tripEntries = useMemo(
    () =>
      store.entries
        .filter((entry) => entry.tripId === tripId && !entry.deleted)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [store.entries, tripId],
  );

  const devMode = useAppOptionsStore((state) => state.devMode);
  const devTripReplay = useAppOptionsStore((state) => state.devTripReplay);
  const inProgressTrip = store.trips.find((item) => item.status === "IN_PROGRESS");

  useIosNativeMapTouchPassthrough(
    getNativePlatform() === "ios" &&
      trip != null &&
      (trip.status === "IN_PROGRESS" || trip.status === "PLANNED"),
  );

  const mediaByEntry = useMemo(() => {
    const map = new Map<string, Media[]>();
    for (const item of store.media) {
      const existing = map.get(item.logEntryId) ?? [];
      existing.push(item);
      map.set(item.logEntryId, existing);
    }
    return map;
  }, [store.media]);

  if (!store.booted) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <DevComponentLabel name="TripDetailPage" />
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading trip…</p>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <DevComponentLabel name="TripDetailPage" />
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] no-underline">
          Back to trips
        </Link>
        <p className="mt-6 text-sm text-[var(--sea-ink-soft)]">Trip not found.</p>
      </main>
    );
  }

  const cover = tripDetailCoverDisplay(trip);
  const displayName = tripDisplayName(trip);

  const handlePhotoPick = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const coverPhotoDataUrl = await readImageFile(file);
      await store.updateTrip(trip.id, { coverKind: "photo", coverPhotoDataUrl });
      toast.success("Trip photo updated");
      setCoverEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload photo");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleChooseMapCover = async () => {
    setBusy(true);
    try {
      await store.updateTrip(trip.id, { coverKind: "map" });
      toast.success("Trip cover set to map");
      setCoverEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update cover");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveCover = async () => {
    setBusy(true);
    try {
      await store.updateTrip(trip.id, { coverKind: null, coverPhotoDataUrl: null });
      toast.success("Trip cover removed");
      setCoverEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove cover");
    } finally {
      setBusy(false);
    }
  };

  const handleChoosePhotoCover = () => {
    fileInputRef.current?.click();
  };

  const handleStartTrip = async () => {
    setBusy(true);
    try {
      await store.addEntry({ tripId: trip.id, type: "START_TRIP" });
      toast.success("Trip started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start trip");
    } finally {
      setBusy(false);
    }
  };

  const handleEndTrip = async () => {
    setBusy(true);
    try {
      await store.addEntry({ tripId: trip.id, type: "END_TRIP" });
      toast.success("Trip completed");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTrip = async () => {
    setBusy(true);
    try {
      await store.deleteTrip(trip.id);
      toast.success("Trip deleted");
      void navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete trip");
    } finally {
      setBusy(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleStartReplay = async (name: string) => {
    if (trip.status !== "COMPLETED") return;
    if (inProgressTrip) {
      toast.error("End the current trip before starting a replay");
      return;
    }

    setBusy(true);
    try {
      const sourceEntries = store.entries.filter(
        (entry) => entry.tripId === trip.id && !entry.deleted,
      );
      const startPosition = replayPositionAt(trip, sourceEntries, 0);
      if (!startPosition) {
        throw new Error("The source trip has no recorded position to replay.");
      }
      setDevPositionOverride(startPosition);

      const targetStartedAt = new Date().toISOString();
      const targetTrip = await useLogbookStore.getState().startTrip({
        boatName: trip.boatName,
        boatId: trip.boatId,
        boatPhotoUrl: trip.boatPhotoUrl,
        registration: trip.registration ?? undefined,
        skipper: trip.skipper ?? undefined,
        skipperKey: trip.skipperKey,
        crewMemberIds: trip.crewMemberIds ?? undefined,
      });
      if (!targetTrip) throw new Error("Could not create the replay trip.");

      await useLogbookStore.getState().updateTrip(targetTrip.id, {
        title: name,
        coverKind: "map",
      });

      const sourceStartEntry = replaySourceEntries(sourceEntries, trip.id).find(
        (entry) => entry.type === "START_TRIP",
      );
      await useLogbookStore.getState().addEntry({
        tripId: targetTrip.id,
        type: "START_TRIP",
        timestamp: targetStartedAt,
        ...startPosition,
        notes: DEV_TRIP_REPLAY_ENTRY_NOTE,
        data: {
          autoGenerated: true,
          source: DEV_TRIP_REPLAY_SOURCE,
          detection: "instrument",
          replaySourceTripId: trip.id,
          replaySourceEntryId: sourceStartEntry?.id ?? `start:${trip.id}`,
        },
      });

      const options = useAppOptionsStore.getState();
      if (options.devTimeTravelEnabled) {
        options.setDevLogEntryDraftTimeIso(targetStartedAt);
      }
      options.setDevTripReplay({
        sourceTripId: trip.id,
        targetTripId: targetTrip.id,
        targetStartedAt,
        realStartedAt: new Date().toISOString(),
      });
      options.setRecordingTripId(targetTrip.id);
      useLogbookStore.getState().selectTrip(targetTrip.id);
      setReplayOpen(false);
      toast.success("Trip replay started");
      void navigate({
        to: "/trips/$tripId",
        params: { tripId: targetTrip.id },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start trip replay",
      );
    } finally {
      setBusy(false);
    }
  };

  const openEntry = (entryId: string) => {
    setSelectedEntryId(entryId);
  };

  const handleCrewChange = async (ids: string[]) => {
    await store.updateTrip(trip.id, { crewMemberIds: ids });
  };

  return (
    <>
      <div
        className={
          getNativePlatform() === 'ios'
            ? 'relative h-dvh w-full overflow-hidden bg-transparent'
            : 'relative h-dvh w-full overflow-hidden'
        }
      >
        <DevComponentLabel
          name="TripDetailPage"
          className="absolute left-3 top-3 z-50 sm:left-4"
        />
        <TripDetailHero
          trip={trip}
          cover={cover}
          mapEntries={tripEntries}
          mapLegs={tripLegs}
          busy={busy}
          onEditCoverClick={() => setCoverEditOpen(true)}
          onLogEntryClick={
            trip.status === "IN_PROGRESS" ? () => setCreateEntryOpen(true) : undefined
          }
        />

        <TripDetailBottomSheet
          leadingAction={
            trip.status === "IN_PROGRESS" ? (
              <TripRecordButton
                tripId={trip.id}
                logEntryDisabled={busy}
                onLogEntryClick={() => setCreateEntryOpen(true)}
              />
            ) : null
          }
        >
          {trip.status === "PLANNED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleStartTrip()}
              className="flex w-full items-center justify-center gap-2 rounded-[1.25rem] bg-[var(--btn-bg)] px-4 py-4 text-base font-bold text-[var(--btn-text)] shadow-sm transition hover:-translate-y-px disabled:opacity-60"
            >
              <Sailboat className="size-5" />
              Start trip
            </button>
          ) : null}

          <TripLegSection
            tripId={trip.id}
            tripStatus={trip.status}
            onOpenEntry={openEntry}
            mediaByEntry={mediaByEntry}
          />

          <NativeRecordingSettings tripInProgress={trip.status === "IN_PROGRESS"} />

          <div className="rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 sm:p-5">
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Boat: {trip.boatName}</p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {trip.status !== "PLANNED" ? (
                <MetaLine label="Started" value={formatDateTime(trip.startedAt)} />
              ) : (
                <MetaLine label="Created" value={formatDateTime(trip.createdAt)} />
              )}
              <MetaLine label="Status" value={trip.status.replace("_", " ")} />
              {trip.status !== "PLANNED" && (
                <>
                  <MetaLine label="Position" value={formatPosition(trip.startLatitude, trip.startLongitude)} />
                  <MetaLine label="Country" value={trip.startCountry ?? "Unknown"} />
                </>
              )}
              {trip.skipper && <MetaLine label="Skipper" value={trip.skipper} icon={User} />}
            </div>

            {trip.status === "IN_PROGRESS" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleEndTrip()}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
                >
                  <Check className="size-4" />
                  End trip
                </button>
              </div>
            )}

            {trip.status === "COMPLETED" && devMode && isDevModeAvailable() ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setReplayOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--brand)]/60 bg-[color-mix(in_oklab,var(--brand-muted)_35%,var(--chip-bg))] px-4 py-2.5 text-sm font-semibold text-[var(--brand)] disabled:opacity-60"
                >
                  <RotateCw className="size-4" />
                  Auto-test replay
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--line)] pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeleteConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:text-red-800 disabled:opacity-60 dark:text-red-300"
            >
              <Trash2 className="size-4" />
              Delete trip
            </button>
          </div>
        </TripDetailBottomSheet>
      </div>

      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void handlePhotoPick(event.target.files?.[0])}
      />

      <LogEntryCreateModal
        open={createEntryOpen}
        tripId={trip.id}
        onClose={() => setCreateEntryOpen(false)}
      />

      <LogEntryComposerModal
        open={selectedEntryId !== null}
        tripId={trip.id}
        entryId={selectedEntryId}
        onClose={() => setSelectedEntryId(null)}
      />

      <TripCrewPickerModal
        open={crewPickerOpen}
        crewMembers={crewMembers}
        selectedIds={trip.crewMemberIds ?? []}
        onClose={() => setCrewPickerOpen(false)}
        onChange={(ids) => void handleCrewChange(ids)}
      />

      <TripCoverEditModal
        open={coverEditOpen}
        busy={busy}
        cover={cover}
        onClose={() => setCoverEditOpen(false)}
        onChoosePhoto={handleChoosePhotoCover}
        onChooseMap={() => void handleChooseMapCover()}
        onRemoveCover={() => void handleRemoveCover()}
      />

      <DevTripReplayModal
        open={replayOpen}
        sourceTrip={trip}
        busy={busy}
        unavailableReason={
          inProgressTrip
            ? "End the current trip before starting a replay."
            : devTripReplay
              ? "Another trip replay is already running."
              : null
        }
        onClose={() => setReplayOpen(false)}
        onConfirm={(name) => void handleStartReplay(name)}
      />

      {deleteConfirmOpen && (
        <Modal
          title="Delete trip?"
          onClose={() => {
            if (!busy) setDeleteConfirmOpen(false);
          }}
          layer="overlay"
          devComponentName="TripDetailPageDeleteModal"
        >
          <div className="space-y-4">
            <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
              Delete <span className="font-semibold text-[var(--sea-ink)]">{displayName}</span>
              {tripEntries.length > 0 ? ` and all ${tripEntries.length} log ${tripEntries.length === 1 ? "entry" : "entries"}` : ""}
              ? This cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDeleteTrip()}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Trash2 className="size-4" />
                {busy ? "Deleting…" : "Delete trip"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteConfirmOpen(false)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function MetaLine({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof User }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-strong)] px-3 py-2.5">
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--sea-ink-soft)]">{label}</p>
      <p className="m-0 mt-1 flex items-center gap-1.5 text-sm font-medium text-[var(--sea-ink)]">
        {Icon && <Icon className="size-3.5 shrink-0" />}
        {value}
      </p>
    </div>
  );
}
