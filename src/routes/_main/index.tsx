import { Link, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Loader2, Sailboat, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { AddBoatModal } from "../../components/AddBoatModal";
import { AddButton } from "../../components/AddButton";
import { BoatsGrid } from "../../components/BoatsGrid";
import { AddCrewMemberModal } from "../../components/AddCrewMemberModal";
import { CrewMembersGrid } from "../../components/CrewMembersGrid";
import { Modal } from "../../components/Modal";
import { SkipperSelect } from "../../components/SkipperSelect";
import { TripCrewPickerModal, TripCrewSection } from "../../components/TripCrewPickerModal";
import type { Trip } from "../../domain/logbook";
import type { CrewMember } from "../../domain/crew";
import { cn } from "../../lib/cn";
import { useSession } from "../../lib/auth-client";
import { fetchBoats } from "../../lib/boats-api";
import { fetchCrew } from "../../lib/crew-api";
import type { Boat } from "../../domain/boat";
import { defaultBoatPhoto } from "../../domain/boat";
import { buildSkipperOptions, resolveTripPersonOption, userTripPersonKey } from "../../lib/trip-people";
import { formatDateTime } from "../../lib/logbook-format";
import { tripCoverPhotoUrl, tripDisplayName, resolveDefaultBoatIdForNewTrip } from "../../lib/trip-display";
import { isDevModeAvailable } from "../../lib/dev-mode";
import { useAppOptionsStore } from "../../stores/app-options";
import { useLogbookStore, triggerLogbookSyncRetry } from "../../stores/logbook";

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

function resolveCurrentTrip(trips: Trip[]): Trip | null {
  return (
    trips.find((trip) => trip.status === "IN_PROGRESS") ??
    trips.find((trip) => trip.status === "PLANNED") ??
    null
  );
}

function resolveLatestCompletedTrip(trips: Trip[]): Trip | null {
  const completed = trips.filter((trip) => trip.status === "COMPLETED");
  if (completed.length === 0) return null;
  return [...completed].sort(
    (a, b) =>
      new Date(b.completedAt ?? b.updatedAt).getTime() -
      new Date(a.completedAt ?? a.updatedAt).getTime(),
  )[0];
}

function LogbookHome() {
  const store = useLogbookStore();
  const devMode = useAppOptionsStore((state) => state.devMode);
  const setLastTripBoatId = useAppOptionsStore((state) => state.setLastTripBoatId);
  const devModeActive = devMode && isDevModeAvailable();
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { startTrip: startTripSearch } = Route.useSearch();
  const [startOpen, setStartOpen] = useState(false);
  const [addBoatOpen, setAddBoatOpen] = useState(false);
  const [addCrewOpen, setAddCrewOpen] = useState(false);
  const [startForm, setStartForm] = useState({
    boatName: "",
    registration: "",
    skipperKey: "",
  });
  const [tripCrewMemberIds, setTripCrewMemberIds] = useState<string[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [crewPickerOpen, setCrewPickerOpen] = useState(false);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [selectedBoatId, setSelectedBoatId] = useState("");
  const [boats, setBoats] = useState<Boat[]>([]);
  const [boatsLoading, setBoatsLoading] = useState(false);
  const startFormInitializedRef = useRef(false);

  const currentTrip = resolveCurrentTrip(store.trips);
  const latestCompletedTrip = resolveLatestCompletedTrip(store.trips);
  const featuredTrip = currentTrip ?? latestCompletedTrip;
  const featuredTripLabel = currentTrip ? "Current trip" : latestCompletedTrip ? "Latest trip" : null;
  const user = session.data?.user;
  const skipperOptions = useMemo(
    () =>
      user
        ? buildSkipperOptions({
            userId: user.id,
            userName: user.name,
            userImage: user.image,
            crewMembers,
          })
        : [],
    [user, crewMembers],
  );

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

  const applyDefaultBoatSelection = (items: Boat[]) => {
    const defaultBoatId = resolveDefaultBoatIdForNewTrip(
      useLogbookStore.getState().trips,
      items,
      useAppOptionsStore.getState().lastTripBoatId,
    );
    if (defaultBoatId) {
      const boat = items.find((item) => item.id === defaultBoatId);
      setSelectedBoatId(defaultBoatId);
      setStartForm((current) => ({
        ...current,
        boatName: boat?.name ?? current.boatName,
      }));
      return;
    }
    setSelectedBoatId("");
    setStartForm((current) => ({ ...current, boatName: "" }));
  };

  useEffect(() => {
    if (!user) {
      setBoats([]);
      return;
    }

    let cancelled = false;
    setBoatsLoading(true);
    void fetchBoats()
      .then((items) => {
        if (cancelled) return;
        setBoats(items);
        triggerLogbookSyncRetry();
      })
      .catch(() => toast.error("Could not load your boats"))
      .finally(() => {
        if (!cancelled) setBoatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!startOpen || !session.data?.user) {
      startFormInitializedRef.current = false;
      return;
    }

    if (!startFormInitializedRef.current && boats.length > 0) {
      startFormInitializedRef.current = true;
      applyDefaultBoatSelection(boats);
    }
  }, [startOpen, session.data?.user, boats]);

  useEffect(() => {
    if (!startOpen || !store.booted || boats.length === 0 || selectedBoatId) return;
    applyDefaultBoatSelection(boats);
  }, [startOpen, store.booted, store.trips, boats, selectedBoatId]);

  useEffect(() => {
    if (!user) {
      setCrewMembers([]);
      return;
    }
    setCrewLoading(true);
    void fetchCrew()
      .then((payload) => {
        setCrewMembers(payload.members);
        triggerLogbookSyncRetry();
      })
      .catch(() => toast.error("Could not load your crew"))
      .finally(() => setCrewLoading(false));
  }, [user]);

  useEffect(() => {
    if (!startOpen || !user) return;
    setStartForm((current) => ({
      ...current,
      skipperKey: userTripPersonKey(user.id),
    }));
    setTripCrewMemberIds([]);
  }, [startOpen, user?.id]);

  useEffect(() => {
    if (!startTripSearch || !session.data?.user) return;
    setStartOpen(true);
    void navigate({ to: "/", search: {}, replace: true });
  }, [startTripSearch, session.data?.user, navigate]);

  const defaultSkipperKey = user ? userTripPersonKey(user.id) : "";
  const effectiveSkipperKey = startForm.skipperKey || defaultSkipperKey;

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
    const selectedBoat = boats.find((boat) => boat.id === selectedBoatId);
    const boatPhoto = selectedBoat ? defaultBoatPhoto(selectedBoat.photos) : null;
    const skipper = resolveTripPersonOption(effectiveSkipperKey, skipperOptions);
    setCreatingTrip(true);
    try {
      const trip = await store.startTrip({
        boatName: startForm.boatName,
        boatId: selectedBoatId,
        boatPhotoUrl: boatPhoto?.imageUrl ?? null,
        registration: startForm.registration,
        skipper: skipper?.name,
        skipperKey: effectiveSkipperKey || null,
        crewMemberIds: tripCrewMemberIds,
      });
      if (trip) {
        setLastTripBoatId(selectedBoatId);
        toast.success(`${tripDisplayName(trip)} created`);
        setStartOpen(false);
        setStartForm({ boatName: "", registration: "", skipperKey: "" });
        setTripCrewMemberIds([]);
        setSelectedBoatId("");
        void navigate({ to: "/trips/$tripId", params: { tripId: trip.id } });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create trip");
    } finally {
      setCreatingTrip(false);
    }
  };

  const openTrip = (tripId: string) => {
    store.selectTrip(tripId);
    void navigate({ to: "/trips/$tripId", params: { tripId } });
  };

  const openAddCrew = () => {
    if (!session.data?.user) {
      void navigate({ to: "/sign-in", search: { redirect: "/crew?addCrew=1" } });
      return;
    }
    setAddCrewOpen(true);
  };

  const openAddBoat = () => {
    if (!session.data?.user) {
      void navigate({ to: "/sign-in", search: { redirect: "/boats?addBoat=1" } });
      return;
    }
    setAddBoatOpen(true);
  };

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4 sm:pb-28">
      {devModeActive && (
        <div className="mb-5 flex flex-wrap gap-2">
          <StatPill label="Trips" value={tripCount} />
          <StatPill label="Entries" value={entryCount} />
          <StatPill label="Unsynced" value={unsyncedCount} muted={!unsyncedCount} />
          <StatPill label="Sync" value={store.syncMessage ?? (store.online ? "Ready" : "Offline")} wide />
        </div>
      )}

      <div className="space-y-10">
        <section className="space-y-4">
          <HomeSectionHeader
            title="Trip"
            to="/trips"
            addLabel="Add trip"
            onAdd={openStartTrip}
          />

          {featuredTrip && featuredTripLabel ? (
            <div className="space-y-3">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--kicker)]">
                {featuredTripLabel}
              </p>
              <TripCard
                trip={featuredTrip}
                entryCount={
                  store.entries.filter(
                    (entry) => entry.tripId === featuredTrip.id && !entry.deleted,
                  ).length
                }
                active={location.pathname === `/trips/${featuredTrip.id}`}
                onSelect={() => openTrip(featuredTrip.id)}
              />
            </div>
          ) : (
            <EmptyState
              title="Add trip"
              description="Start a sailing session to create your first trip and begin logging."
              actionLabel="Add trip"
              onAction={openStartTrip}
              icon={Sailboat}
              compact
            />
          )}
        </section>

        <section className="space-y-4">
          <HomeSectionHeader
            title="Crew"
            to="/crew"
            addLabel="Add crew member"
            onAdd={openAddCrew}
          />

          {!user ? (
            <SignInPrompt redirect="/crew" message="Sign in to build your crew and connect with sailing friends." />
          ) : crewLoading ? (
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Loading crew…</p>
          ) : crewMembers.length === 0 ? (
            <EmptyState
              title="Add crew member"
              description="Add crew by name and photo. Include an email to send an invite."
              actionLabel="Add crew member"
              onAction={openAddCrew}
              icon={Users}
              compact
            />
          ) : (
            <CrewMembersGrid members={crewMembers} />
          )}
        </section>

        <section className="space-y-4">
          <HomeSectionHeader
            title="Boats"
            to="/boats"
            addLabel="Add boat"
            onAdd={openAddBoat}
          />

          {!user ? (
            <SignInPrompt redirect="/boats" message="Sign in to create and manage your boats." />
          ) : boatsLoading ? (
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Loading boats…</p>
          ) : boats.length === 0 ? (
            <EmptyState
              title="Add boat"
              description="Add your first boat with a name and photos."
              actionLabel="Add boat"
              onAction={openAddBoat}
              icon={Sailboat}
              compact
            />
          ) : (
            <BoatsGrid boats={boats} />
          )}
        </section>
      </div>

      {store.booted && !store.online && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] shadow-lg">
          Offline mode active. Saves stay local until the connection returns.
        </div>
      )}

      <AddCrewMemberModal
        open={addCrewOpen}
        onClose={() => setAddCrewOpen(false)}
        onCreated={(member) => {
          setCrewMembers((current) => [...current, member]);
        }}
      />

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
                <option value="">{boatsLoading ? "Loading boats…" : "Select boat…"}</option>
                {boats.map((boat) => (
                  <option key={boat.id} value={boat.id}>
                    {boat.name}
                  </option>
                ))}
                <option value="__add__">Add boat…</option>
              </select>
            </label>

            <div className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">Skipper</span>
              <SkipperSelect
                value={effectiveSkipperKey}
                options={skipperOptions}
                onChange={(skipperKey) =>
                  setStartForm((current) => ({
                    ...current,
                    skipperKey,
                  }))
                }
              />
            </div>

            <TripCrewSection
              crewMembers={crewMembers}
              selectedIds={tripCrewMemberIds}
              onAddClick={() => setCrewPickerOpen(true)}
            />
            {crewLoading && <p className="m-0 text-xs text-[var(--sea-ink-soft)]">Refreshing crew list…</p>}

            <p className="m-0 text-xs leading-6 text-[var(--sea-ink-soft)]">
              Location, timestamp, weather, and country are captured automatically when the trip starts.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={creatingTrip}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
              >
                {creatingTrip ? <Loader2 className="size-4 animate-spin" /> : <Sailboat className="size-4" />}
                {creatingTrip ? "Creating trip…" : "Create trip"}
              </button>
              <button
                type="button"
                onClick={() => setStartOpen(false)}
                disabled={creatingTrip}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      <TripCrewPickerModal
        open={crewPickerOpen}
        crewMembers={crewMembers}
        selectedIds={tripCrewMemberIds}
        onClose={() => setCrewPickerOpen(false)}
        onChange={setTripCrewMemberIds}
      />

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

function HomeSectionHeader({
  title,
  to,
  addLabel,
  onAdd,
}: {
  title: string;
  to: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Link
        to={to}
        className="group inline-flex min-w-0 items-center gap-1 no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
      >
        <h2 className="brand-title m-0 text-[1.75rem] leading-none sm:text-[2rem]">{title}</h2>
        <ChevronRight
          className="size-6 shrink-0 text-[var(--brand)] transition group-hover:translate-x-0.5"
          strokeWidth={2.5}
          aria-hidden
        />
      </Link>
      <AddButton onClick={onAdd} aria-label={addLabel} />
    </div>
  );
}

function SignInPrompt({ redirect, message }: { redirect: string; message: string }) {
  return (
    <div className="rounded-[1.4rem] border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-6 text-center">
      <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">{message}</p>
      <Link
        to="/sign-in"
        search={{ redirect }}
        className="brand-emphasis mt-3 inline-flex text-sm font-semibold no-underline hover:text-[var(--brand-hover)]"
      >
        Sign in
      </Link>
    </div>
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
  const coverPhoto = tripCoverPhotoUrl(trip);
  const name = tripDisplayName(trip);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full overflow-hidden rounded-[1.4rem] border text-left transition hover:-translate-y-px",
        active
          ? "border-[var(--active-border)] bg-[var(--active-panel)] shadow-sm"
          : "border-[var(--panel-border)] bg-[var(--panel)]",
      )}
    >
      <div className="w-32 shrink-0 overflow-hidden bg-[var(--chip-bg)]">
        {coverPhoto ? (
          <img src={coverPhoto} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--sea-ink-soft)]">
            <Sailboat className="size-10" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--kicker)]">
                {trip.status.replace("_", " ")}
              </p>
              <h3 className="m-0 mt-1 truncate text-lg font-bold text-[var(--sea-ink)]">{name}</h3>
              <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
                {trip.status === "PLANNED"
                  ? `Created ${formatDateTime(trip.createdAt)}`
                  : formatDateTime(trip.startedAt)}
                {trip.completedAt ? ` · completed ${formatDateTime(trip.completedAt)}` : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-3 py-2 text-right">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--sea-ink-soft)]">
                Entries
              </p>
              <p className="m-0 text-xl font-bold text-[var(--sea-ink)]">{entryCount}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--sea-ink-soft)]">
            {trip.boatName !== name && <Badge>{trip.boatName}</Badge>}
            {trip.startCountry && <Badge>{trip.startCountry}</Badge>}
            {trip.skipper && <Badge>{trip.skipper}</Badge>}
          </div>
        </div>
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

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2.5 py-1 text-xs font-medium text-[var(--sea-ink-soft)]">
      {children}
    </span>
  );
}
