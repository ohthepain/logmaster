import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Anchor,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Edit3,
  FileText,
  ImagePlus,
  Mic,
  Plus,
  Sailboat,
  Send,
  Trash2,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { AddBoatModal } from "../../components/AddBoatModal";
import { Modal } from "../../components/Modal";
import { LOG_ENTRY_TYPES, entryIcon, entryTitle } from "../../domain/logbook";
import type { LogEntry, LogEntryType, Media, Trip, WeatherSnapshot } from "../../domain/logbook";
import { cn } from "../../lib/cn";
import { useSession } from "../../lib/auth-client";
import { fetchBoats } from "../../lib/boats-api";
import type { Boat } from "../../domain/boat";
import { isDevModeAvailable } from "../../lib/dev-mode";
import { useAppOptionsStore } from "../../stores/app-options";
import { useLogbookStore } from "../../stores/logbook";

type HomeSearch = { startTrip?: boolean };

export const Route = createFileRoute("/_main/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const value = search.startTrip;
    if (value === true || value === "true" || value === "1" || value === 1) {
      return { startTrip: true };
    }
    return {};
  },
  component: LogbookHome,
});

function resolveSelectedTrip(trips: Trip[], selectedTripId: string | null): Trip | null {
  if (trips.length === 0) return null;
  if (selectedTripId) {
    const selected = trips.find((trip) => trip.id === selectedTripId);
    if (selected) return selected;
  }
  return trips[0];
}

function LogbookHome() {
  const store = useLogbookStore();
  const devMode = useAppOptionsStore((state) => state.devMode);
  const devModeActive = devMode && isDevModeAvailable();
  const session = useSession();
  const navigate = useNavigate();
  const { startTrip: startTripSearch } = Route.useSearch();
  const [startOpen, setStartOpen] = useState(false);
  const [addBoatOpen, setAddBoatOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<LogEntryType>("NOTE");
  const [startForm, setStartForm] = useState({
    boatName: "",
    registration: "",
    skipper: "",
  });
  const [selectedBoatId, setSelectedBoatId] = useState("");
  const [boats, setBoats] = useState<Boat[]>([]);
  const [boatsLoading, setBoatsLoading] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTrip = resolveSelectedTrip(store.trips, store.selectedTripId);
  const selectedTripEntries = useMemo(
    () => (selectedTrip ? store.entries.filter((entry) => entry.tripId === selectedTrip.id && !entry.deleted) : []),
    [selectedTrip, store.entries],
  );
  const selectedTripMedia = useMemo(() => {
    const mediaByEntry = new Map<string, Media[]>();
    for (const media of store.media) {
      const existing = mediaByEntry.get(media.logEntryId) ?? [];
      existing.push(media);
      mediaByEntry.set(media.logEntryId, existing);
    }
    return mediaByEntry;
  }, [store.media]);
  const activeTrip = store.trips.find((trip) => trip.status === "IN_PROGRESS") ?? null;

  useEffect(() => {
    void useLogbookStore.getState().load();
  }, []);

  useEffect(() => {
    const syncOnline = () => useLogbookStore.getState().setOnline(true);
    const syncOffline = () => useLogbookStore.getState().setOnline(false);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOffline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOffline);
    };
  }, []);

  useEffect(() => {
    if (store.booted && store.online) {
      void useLogbookStore.getState().syncNow();
    }
  }, [store.booted, store.online]);

  useEffect(() => {
    if (selectedType !== "PHOTO") {
      fileInputRef.current?.value && (fileInputRef.current.value = "");
    }
  }, [selectedType]);

  useEffect(() => {
    if (!startOpen || !session.data?.user) {
      setBoats([]);
      return;
    }
    setBoatsLoading(true);
    void fetchBoats()
      .then((items) => setBoats(items))
      .catch(() => toast.error("Could not load your boats"))
      .finally(() => setBoatsLoading(false));
  }, [startOpen, session.data?.user]);

  useEffect(() => {
    if (!startTripSearch || !session.data?.user) return;
    setStartOpen(true);
    void navigate({ to: "/", search: {}, replace: true });
  }, [startTripSearch, session.data?.user, navigate]);

  const openStartTrip = () => {
    if (!session.data?.user) {
      void navigate({ to: "/sign-in", search: { redirect: "/?startTrip=1" } });
      return;
    }
    setStartOpen(true);
  };

  const tripCount = store.trips.length;
  const entryCount = store.entries.filter((entry) => !entry.deleted).length;
  const unsyncedCount = store.entries.filter((entry) => !entry.synced && !entry.deleted).length;

  const handleStartTrip = async (event: FormEvent) => {
    event.preventDefault();
    if (!session.data?.user) {
      toast.error("Sign in to start a trip");
      setStartOpen(false);
      void navigate({ to: "/sign-in", search: { redirect: "/?startTrip=1" } });
      return;
    }
    if (!selectedBoatId || !startForm.boatName.trim()) {
      toast.error("Select a boat");
      return;
    }
    const trip = await store.startTrip(startForm);
    if (trip) {
      toast.success(`${trip.boatName} is now sailing`);
      setStartOpen(false);
      setStartForm({ boatName: "", registration: "", skipper: "" });
      setSelectedBoatId("");
    }
  };

  const handleAddEntry = async () => {
    if (!selectedTrip) return;
    const entry = await store.addEntry({
      tripId: selectedTrip.id,
      type: selectedType,
      notes: draftNote,
    });
    if (!entry) return;
    toast.success("Saved locally");
    setComposerOpen(false);
    setDraftNote("");
    setSelectedType("NOTE");
  };

  const handleEventQuickAdd = async (type: LogEntryType) => {
    if (!selectedTrip) return;
    await store.addEntry({ tripId: selectedTrip.id, type });
    toast.success(entryTitle(type));
  };

  const handlePhotoPick = async () => {
    if (!selectedTrip) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a photo first");
      return;
    }
    const entry = await store.addEntry({
      tripId: selectedTrip.id,
      type: "PHOTO",
      notes: draftNote,
      data: { fileName: file.name, size: file.size, mimeType: file.type },
    });
    if (!entry) return;
    await store.attachMedia(entry.id, {
      logEntryId: entry.id,
      type: "photo",
      localPath: file.name,
      remoteUrl: null,
      thumbnailUrl: URL.createObjectURL(file),
    });
    toast.success("Photo saved locally");
    setComposerOpen(false);
    setDraftNote("");
  };

  const handleVoicePlaceholder = async () => {
    if (!selectedTrip) return;
    await store.addEntry({
      tripId: selectedTrip.id,
      type: "VOICE_NOTE",
      notes: draftNote || "Voice note placeholder",
      data: { placeholder: true },
    });
    toast.success("Voice note placeholder saved locally");
    setComposerOpen(false);
    setDraftNote("");
  };

  const openEdit = (entry: LogEntry) => {
    setEditingEntryId(entry.id);
    setEditingNote(entry.notes ?? "");
  };

  const saveEdit = async () => {
    if (!editingEntryId) return;
    await store.updateEntry(editingEntryId, { notes: editingNote });
    setEditingEntryId(null);
    setEditingNote("");
  };

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4 sm:pb-28">
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--panel-border)] bg-[var(--surface-strong)] p-5 shadow-[0_16px_48px_var(--hero-a)] sm:p-7">
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <p className="island-kicker">Offline-first sail logbook</p>

            {devModeActive && (
              <div className="flex flex-wrap gap-2">
                <StatPill label="Trips" value={tripCount} />
                <StatPill label="Entries" value={entryCount} />
                <StatPill label="Unsynced" value={unsyncedCount} muted={!unsyncedCount} />
                <StatPill label="Sync" value={store.syncMessage ?? (store.online ? "Ready" : "Offline")} wide />
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
            <button
              type="button"
              onClick={openStartTrip}
              className="flex items-center justify-between rounded-2xl bg-[var(--btn-bg)] px-4 py-4 text-left text-[var(--btn-text)] shadow-sm transition hover:translate-y-[-1px]"
            >
              <span>
                <span className="mt-1 block text-lg font-bold">Add Trip ...</span>
              </span>
              <ChevronRight className="size-6" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <QuickAction label="Log Entry" icon={Plus} onClick={() => setComposerOpen(true)} />
              <QuickAction
                label="Event"
                icon={Waves}
                onClick={() => {
                  setSelectedType("SAILS_UP");
                  setComposerOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <div className="space-y-4">
          <PanelTitle
            kicker="Trips"
            title={activeTrip ? "Trip in progress" : "All trips"}
            subtitle="Tap a trip to review the timeline and clean up notes after the sail."
          />

          {store.trips.length === 0 ? (
            <EmptyState
              title="No trips yet"
              description="Start a sailing session to create the first trip and begin logging locally."
              actionLabel="Start Sailing"
              onAction={openStartTrip}
              icon={Sailboat}
            />
          ) : (
            <div className="space-y-3">
              {store.trips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  entryCount={store.entries.filter((entry) => entry.tripId === trip.id && !entry.deleted).length}
                  active={trip.id === selectedTrip?.id}
                  onSelect={() => store.selectTrip(trip.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <PanelTitle
            kicker={selectedTrip?.status === "COMPLETED" ? "Completed trip" : selectedTrip ? "Timeline" : "Timeline"}
            title={selectedTrip?.boatName ?? "Select a trip"}
            subtitle={
              selectedTrip
                ? `${selectedTrip.status.replace("_", " ").toLowerCase()} • ${selectedTripEntries.length} entries`
                : "Pick a trip from the left to view the logbook timeline."
            }
          />

          {selectedTrip ? (
            <>
              <div className="grid gap-3 rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                <TripDetail trip={selectedTrip} />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType("NOTE");
                      setComposerOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] transition hover:translate-y-[-1px]"
                  >
                    <FileText className="size-4" />
                    Log Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
                  >
                    <Send className="size-4" />
                    Event
                  </button>
                  {selectedTrip.status !== "COMPLETED" && (
                    <button
                      type="button"
                      onClick={() => handleEventQuickAdd("END_TRIP")}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--panel-hover)]"
                    >
                      <Check className="size-4" />
                      End Trip
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {selectedTripEntries.length === 0 ? (
                  <EmptyState
                    title="No log entries yet"
                    description="Add the first note or event to start the timeline."
                    actionLabel="Log Entry"
                    onAction={() => setComposerOpen(true)}
                    icon={Anchor}
                    compact
                  />
                ) : (
                  selectedTripEntries.map((entry, index) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      media={selectedTripMedia.get(entry.id) ?? []}
                      first={index === 0}
                      last={index === selectedTripEntries.length - 1}
                      onEdit={() => openEdit(entry)}
                      onDelete={() => void store.deleteEntry(entry.id)}
                      onMoveUp={() => void store.nudgeEntryTime(entry.id, -5)}
                      onMoveDown={() => void store.nudgeEntryTime(entry.id, 5)}
                      editing={editingEntryId === entry.id}
                      editingNote={editingNote}
                      onEditingNoteChange={setEditingNote}
                      onSaveEdit={saveEdit}
                      onCancelEdit={() => {
                        setEditingEntryId(null);
                        setEditingNote("");
                      }}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="Choose a trip"
              description="The timeline lives here. Start a sailing session to see log entries appear immediately."
              actionLabel="Start Sailing"
              onAction={openStartTrip}
              icon={Waves}
            />
          )}
        </div>
      </section>

      {store.booted && !store.online && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] shadow-lg">
          Offline mode active. Saves stay local until the connection returns.
        </div>
      )}

      {composerOpen && selectedTrip && (
        <Modal title="Log Entry" onClose={() => setComposerOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LOG_ENTRY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition",
                    selectedType === type
                      ? "border-[var(--sea-ink)] bg-[var(--active-panel)] text-[var(--sea-ink)]"
                      : "border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]",
                  )}
                >
                  <span className="block text-lg">{entryIcon(type)}</span>
                  <span className="mt-1 block">{entryTitle(type)}</span>
                </button>
              ))}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">Note</span>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                rows={4}
                placeholder="Short note, observation, or reminder"
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>

            {selectedType === "PHOTO" && (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="block w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-sm text-[var(--sea-ink)]"
                />
                <p className="m-0 text-xs leading-6 text-[var(--sea-ink-soft)]">
                  Photos are stored locally in the Media table for later sync and thumbnail handling.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleAddEntry()}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)]"
              >
                <Check className="size-4" />
                Save locally
              </button>
              {selectedType === "PHOTO" && (
                <button
                  type="button"
                  onClick={() => void handlePhotoPick()}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
                >
                  <ImagePlus className="size-4" />
                  Save photo
                </button>
              )}
              {selectedType === "VOICE_NOTE" && (
                <button
                  type="button"
                  onClick={() => void handleVoicePlaceholder()}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
                >
                  <Mic className="size-4" />
                  Save voice placeholder
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {startOpen && session.data?.user && (
        <Modal title="Create Trip" onClose={() => setStartOpen(false)}>
          <form className="space-y-4" onSubmit={(e) => void handleStartTrip(e)}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">Boat</span>
              <select
                value={selectedBoatId}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "__add__") {
                    setStartOpen(false);
                    setAddBoatOpen(true);
                    return;
                  }
                  setSelectedBoatId(value);
                  const boat = boats.find((item) => item.id === value);
                  setStartForm((current) => ({
                    ...current,
                    boatName: boat?.name ?? "",
                  }));
                }}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              >
                <option value="">{boatsLoading ? "Loading boats…" : "Select a boat…"}</option>
                {boats.map((boat) => (
                  <option key={boat.id} value={boat.id}>
                    {boat.name}
                  </option>
                ))}
                <option value="__add__">Add boat…</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">Skipper</span>
              <input
                value={startForm.skipper}
                onChange={(e) =>
                  setStartForm((current) => ({
                    ...current,
                    skipper: e.target.value,
                  }))
                }
                placeholder="Optional skipper"
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>

            <p className="m-0 text-xs leading-6 text-[var(--sea-ink-soft)]">
              Location, timestamp, weather, and country are captured automatically when the trip starts.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)]"
              >
                <Sailboat className="size-4" />
                Create trip
              </button>
              <button
                type="button"
                onClick={() => setStartOpen(false)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      <AddBoatModal
        open={addBoatOpen}
        onClose={() => setAddBoatOpen(false)}
        onCreated={(boat) => {
          setBoats((current) => [...current, boat]);
          setSelectedBoatId(boat.id);
          setStartForm((current) => ({
            ...current,
            boatName: boat.name,
          }));
          setStartOpen(true);
        }}
      />
    </main>
  );
}

function StatPill({
  label,
  value,
  muted,
  wide,
}: {
  label: string;
  value: number | string;
  muted?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2.5 text-[var(--sea-ink)]",
        wide && "min-w-[11rem] sm:min-w-[13rem]",
      )}
    >
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--sea-ink-soft)]">{label}</p>
      <p className={cn("m-0 mt-1 text-sm font-semibold", muted && "text-[var(--sea-ink-soft)]")}>{value}</p>
    </div>
  );
}

function PanelTitle({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <p className="island-kicker">{kicker}</p>
      <h2 className="m-0 text-2xl font-bold tracking-tight text-[var(--sea-ink)]">{title}</h2>
      <p className="m-0 max-w-2xl text-sm leading-7 text-[var(--sea-ink-soft)]">{subtitle}</p>
    </div>
  );
}

function TripCard({
  trip,
  entryCount,
  active,
  onSelect,
}: {
  trip: Trip;
  entryCount: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[1.4rem] border p-4 text-left transition hover:-translate-y-[1px]",
        active
          ? "border-[var(--active-border)] bg-[var(--active-panel)] shadow-sm"
          : "border-[var(--panel-border)] bg-[var(--panel)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--kicker)]">
            {trip.status.replace("_", " ")}
          </p>
          <h3 className="m-0 mt-1 truncate text-lg font-bold text-[var(--sea-ink)]">{trip.boatName}</h3>
          <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
            {formatDateTime(trip.startedAt)}
            {trip.completedAt ? ` · completed ${formatDateTime(trip.completedAt)}` : ""}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-3 py-2 text-right">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--sea-ink-soft)]">Entries</p>
          <p className="m-0 text-xl font-bold text-[var(--sea-ink)]">{entryCount}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--sea-ink-soft)]">
        {trip.startCountry && <Badge>{trip.startCountry}</Badge>}
        {trip.registration && <Badge>{trip.registration}</Badge>}
        {trip.skipper && <Badge>{trip.skipper}</Badge>}
      </div>
    </button>
  );
}

function TripDetail({ trip }: { trip: Trip }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <DetailLine label="Started" value={formatDateTime(trip.startedAt)} />
      <DetailLine label="Status" value={trip.status.replace("_", " ")} />
      <DetailLine label="Position" value={formatPosition(trip.startLatitude, trip.startLongitude)} />
      <DetailLine label="Country" value={trip.startCountry ?? "Unknown"} />
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2.5">
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--sea-ink-soft)]">{label}</p>
      <p className="m-0 mt-1 text-sm font-medium text-[var(--sea-ink)]">{value}</p>
    </div>
  );
}

function EntryCard({
  entry,
  media,
  first,
  last,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  editing,
  editingNote,
  onEditingNoteChange,
  onSaveEdit,
  onCancelEdit,
}: {
  entry: LogEntry;
  media: Media[];
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  editing: boolean;
  editingNote: string;
  onEditingNoteChange: (next: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-[1.5rem] border p-4 shadow-sm",
        entry.deleted ? "border-red-500/30 bg-red-500/5" : "border-[var(--panel-border)] bg-[var(--surface-strong)]",
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] text-xl">
          {entryIcon(entry.type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{entryTitle(entry.type)}</p>
              <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                {formatDateTime(entry.timestamp)}
                {entry.accuracy != null ? ` · ±${Math.round(entry.accuracy)}m` : ""}
              </p>
            </div>
            <SyncBadge synced={entry.synced} deleted={entry.deleted} />
          </div>

          <div className="mt-2 space-y-2 text-sm text-[var(--sea-ink)]">
            <p className="m-0">{formatPosition(entry.latitude, entry.longitude)}</p>
            {entry.heading != null && <p className="m-0">Heading {Math.round(entry.heading)}°</p>}
            {entry.notes && !editing && <p className="m-0">{entry.notes}</p>}
            {entry.weather && (
              <p className="m-0 text-xs text-[var(--sea-ink-soft)]">Weather: {formatWeather(entry.weather)}</p>
            )}
            {media.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {media.map((item) => (
                  <Badge key={item.id}>
                    {item.type}
                    {item.localPath ? ` · ${item.localPath}` : ""}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={editingNote}
                onChange={(e) => onEditingNoteChange(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSaveEdit}
                  className="rounded-full bg-[var(--btn-bg)] px-3 py-2 text-xs font-semibold text-[var(--btn-text)]"
                >
                  Save note
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-xs font-semibold text-[var(--sea-ink)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <IconButton icon={Edit3} label="Edit" onClick={onEdit} />
              <IconButton icon={ArrowUp} label="Earlier" onClick={onMoveUp} disabled={first} />
              <IconButton icon={ArrowDown} label="Later" onClick={onMoveDown} disabled={last} />
              <IconButton icon={Trash2} label="Delete" onClick={onDelete} danger />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition",
        danger
          ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300 hover:bg-red-500/10"
          : "border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function QuickAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-4 text-left text-[var(--sea-ink)] transition hover:bg-[var(--panel-hover)]"
    >
      <span className="flex size-9 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-[var(--surface)]">
        <Icon className="size-4" />
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
  compact,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  icon: ComponentType<{ className?: string }>;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--panel)] p-5 text-center",
        compact && "p-4",
      )}
    >
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] text-[var(--sea-ink)]">
        <Icon className="size-5" />
      </div>
      <h3 className="m-0 text-lg font-bold text-[var(--sea-ink)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-[var(--sea-ink-soft)]">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)]"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function SyncBadge({ synced, deleted }: { synced: boolean; deleted: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]",
        deleted
          ? "bg-red-500/10 text-red-700 dark:text-red-300"
          : synced
            ? "border border-[var(--line)] bg-[var(--panel)] text-[var(--sea-ink-soft)]"
            : "border border-[var(--line)] bg-[var(--panel)] text-[var(--sea-ink)]",
      )}
    >
      {deleted ? "Deleted" : synced ? "Synced" : "Saved locally"}
    </span>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2.5 py-1 text-xs font-medium text-[var(--sea-ink-soft)]">
      {children}
    </span>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPosition(latitude?: number | null, longitude?: number | null) {
  if (latitude == null || longitude == null) return "Position unavailable";
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

function formatWeather(weather: WeatherSnapshot) {
  const parts: string[] = [];
  if (typeof weather.temperatureC === "number") {
    parts.push(`${Math.round(weather.temperatureC)}°C`);
  }
  if (typeof weather.windKph === "number") {
    parts.push(`${Math.round(weather.windKph)} km/h wind`);
  }
  if (typeof weather.cloudCoverPct === "number") {
    parts.push(`${Math.round(weather.cloudCoverPct)}% cloud`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Weather available";
}
