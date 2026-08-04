import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Sailboat, Trash2, User } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LogEntryCard } from "./LogEntryCard";
import { DevComponentLabel } from "./DevComponentLabel";
import { LogEntryComposerModal } from "./LogEntryComposerModal";
import { Modal } from "./Modal";
import { TripCrewPickerModal } from "./TripCrewPickerModal";
import { TripDetailHero } from "./TripDetailHero";
import { TripLegSection } from "./TripLegSection";
import { TripLogMap } from "./TripLogMap";
import { TripOperationalStatus } from "./TripOperationalStatus";
import { NativeRecordingSettings } from "./NativeRecordingSettings";
import type { Media } from "../domain/logbook";
import type { CrewMember } from "../domain/crew";
import { useSession } from "../lib/auth-client";
import { fetchCrew } from "../lib/crew-api";
import { readImageFile } from "../lib/image-file";
import { formatDateTime, formatPosition } from "../lib/logbook-format";
import {
  buildSkipperOptions,
  parseTripPersonKey,
  resolveTripPersonOption,
} from "../lib/trip-people";
import { tripCoverPhotoUrl, tripDisplayName } from "../lib/trip-display";
import { useLogbookStore, triggerLogbookSyncRetry } from "../stores/logbook";

type TripDetailPageProps = {
  tripId: string;
};

export function TripDetailPage({ tripId }: TripDetailPageProps) {
  const navigate = useNavigate();
  const session = useSession();
  const store = useLogbookStore();
  const trip = store.trips.find((item) => item.id === tripId) ?? null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [crewPickerOpen, setCrewPickerOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);

  useEffect(() => {
    void useLogbookStore.getState().load();
  }, []);

  useEffect(() => {
    useLogbookStore.getState().selectTrip(tripId);
  }, [tripId]);

  useEffect(() => {
    if (!trip) return;
    setTitle(trip.title ?? "");
  }, [trip]);

  useEffect(() => {
    setCrewLoading(true);
    void fetchCrew()
      .then((payload) => {
        setCrewMembers(payload.members);
        triggerLogbookSyncRetry();
      })
      .catch(() => toast.error("Could not load your crew"))
      .finally(() => setCrewLoading(false));
  }, [tripId]);

  useEffect(() => {
    setSelectedLegId(null);
  }, [tripId]);

  const tripEntries = useMemo(
    () =>
      store.entries
        .filter((entry) => entry.tripId === tripId && !entry.deleted)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [store.entries, tripId],
  );

  const entries = useMemo(
    () =>
      tripEntries.filter((entry) => !selectedLegId || entry.legId === selectedLegId),
    [tripEntries, selectedLegId],
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

  const skipperOptions = useMemo(() => {
    const user = session.data?.user;
    if (!user) return [];
    return buildSkipperOptions({
      userId: user.id,
      userName: user.name,
      userImage: user.image,
      crewMembers,
    });
  }, [session.data?.user, crewMembers]);

  const tripCrew = useMemo(() => {
    if (!trip) return [];
    const selected = crewMembers.filter((member) => (trip.crewMemberIds ?? []).includes(member.id));
    const skipperKey = trip.skipperKey;
    if (!skipperKey) return selected;

    const parsed = parseTripPersonKey(skipperKey);
    if (parsed?.kind !== "crew") return selected;

    return selected.filter((member) => member.id !== parsed.id);
  }, [trip, crewMembers]);

  const skipperPerson = useMemo(
    () => (trip ? resolveTripPersonOption(trip.skipperKey, skipperOptions) : null),
    [trip, skipperOptions],
  );

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

  const coverPhoto = tripCoverPhotoUrl(trip);
  const displayName = tripDisplayName(trip);

  const saveTitle = async () => {
    const trimmed = title.trim();
    if (trimmed === (trip.title ?? "")) return;
    await store.updateTrip(trip.id, { title: trimmed || null });
    toast.success("Trip name updated");
  };

  const handlePhotoPick = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const coverPhotoDataUrl = await readImageFile(file);
      await store.updateTrip(trip.id, { coverPhotoDataUrl });
      toast.success("Trip photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload photo");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!coverPhoto) return;
    setBusy(true);
    try {
      await store.updateTrip(trip.id, { coverPhotoDataUrl: null });
      toast.success("Trip photo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove photo");
    } finally {
      setBusy(false);
    }
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

  const handleQuickNote = async () => {
    setBusy(true);
    try {
      const entry = await store.addEntry({ tripId: trip.id, type: "NOTE" });
      if (!entry) return;
      toast.success("Note added — tap to edit");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add note");
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

  const openEntry = (entryId: string) => {
    setSelectedEntryId(entryId);
  };

  const handleCrewChange = async (ids: string[]) => {
    await store.updateTrip(trip.id, { crewMemberIds: ids });
  };

  return (
    <>
      <DevComponentLabel name="TripDetailPage" />
      <TripDetailHero
        trip={trip}
        title={title}
        coverPhoto={coverPhoto}
        busy={busy}
        skipperName={skipperPerson?.name ?? trip.skipper ?? null}
        skipperImageUrl={skipperPerson?.imageUrl ?? null}
        skipperUserId={
          skipperPerson?.kind === "user"
            ? skipperPerson.id
            : (skipperPerson?.linkedUserId ?? undefined)
        }
        crewMembers={tripCrew}
        crewLoading={crewLoading}
        onTitleChange={setTitle}
        onTitleBlur={() => void saveTitle()}
        onPhotoClick={() => fileInputRef.current?.click()}
        onAddCrewClick={() => setCrewPickerOpen(true)}
      />
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void handlePhotoPick(event.target.files?.[0])}
      />

      <main className="page-wrap px-3 pb-24 pt-4 sm:px-4 sm:pb-28">
        <div className="mx-auto max-w-3xl space-y-5">
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
          ) : trip.status === "IN_PROGRESS" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleQuickNote()}
              className="flex w-full items-center justify-center gap-2 rounded-[1.25rem] border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-3 text-sm font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Add note
            </button>
          ) : null}

          <TripOperationalStatus tripId={trip.id} trip={trip} entries={tripEntries} />

          <TripLegSection
            tripId={trip.id}
            selectedLegId={selectedLegId}
            onSelectLeg={setSelectedLegId}
          />

          <TripLogMap trip={trip} entries={entries} />

          <NativeRecordingSettings tripInProgress={trip.status === "IN_PROGRESS"} />

          {entries.length === 0 ? (
            <div className="rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-10 text-center">
              <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
                {trip.status === "PLANNED"
                  ? "Start the trip or log your first entry."
                  : "No log entries yet. Add the first note or event."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <LogEntryCard
                  key={entry.id}
                  entry={entry}
                  media={mediaByEntry.get(entry.id) ?? []}
                  onOpen={() => openEntry(entry.id)}
                />
              ))}
            </div>
          )}

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

            {coverPhoto && trip.coverPhotoDataUrl && (
              <button
                type="button"
                onClick={() => void handleRemovePhoto()}
                disabled={busy}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300"
              >
                <Trash2 className="size-3.5" />
                Remove photo
              </button>
            )}
          </div>

          <div className="border-t border-[var(--line)] pt-4 pb-8">
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
        </div>
      </main>

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
              {entries.length > 0 ? ` and all ${entries.length} log ${entries.length === 1 ? "entry" : "entries"}` : ""}
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
