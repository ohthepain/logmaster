import { create } from 'zustand'
import type {
  Leg,
  LogEntry,
  LogEntryType,
  Media,
  Trip,
  TripStatus,
} from '../domain/logbook'
import { captureLogbookContext } from '../lib/logbook-context'
import { defaultTripTitle } from '../lib/trip-display'
import {
  bootstrapLogbook,
  hasPendingSync,
  syncLogbook,
} from '../lib/logbook-sync'
import type { LogbookSnapshot } from '../lib/logbook-sync'
import {
  mergeLegs,
  rebuildLegsForTrip,
  sortLegs,
} from '../lib/trip-legs'
import { syncTripOperationalFields } from '../domain/trip-state'
import {
  addPendingDeletedTripId,
  addPendingTripId,
  deleteLeg,
  deleteLogEntry,
  deleteMedia,
  deleteTrip as deleteTripFromIdb,
  loadLogbookSnapshot,
  putLeg,
  putLogEntry,
  putMedia,
  putTrip,
  removePendingTripIds,
} from '../lib/logbook-idb'

type NewTripInput = {
  boatName: string
  boatId?: string | null
  boatPhotoUrl?: string | null
  registration?: string
  skipper?: string
  skipperKey?: string | null
  crewMemberIds?: string[]
}

type NewEntryInput = {
  tripId: string
  type: LogEntryType
  notes?: string
  data?: Record<string, unknown>
  heading?: number | null
  latitude?: number | null
  longitude?: number | null
  accuracy?: number | null
  timestamp?: string
}

type UpdateEntryInput = Partial<
  Pick<
    LogEntry,
    'notes' | 'data' | 'heading' | 'type' | 'deleted' | 'latitude' | 'longitude' | 'accuracy'
  >
>

type UpdateTripInput = Partial<
  Pick<
    Trip,
    | 'title'
    | 'coverPhotoDataUrl'
    | 'boatName'
    | 'registration'
    | 'skipper'
    | 'crewMemberIds'
  >
>

type UpdateLegInput = Partial<Pick<Leg, 'title'>>

type LogbookState = {
  trips: Trip[]
  legs: Leg[]
  entries: LogEntry[]
  media: Media[]
  activeTripId: string | null
  selectedTripId: string | null
  booted: boolean
  syncing: boolean
  syncQueued: boolean
  online: boolean
  syncMessage: string | null
  load: () => Promise<void>
  setOnline: (online: boolean) => void
  selectTrip: (tripId: string | null) => void
  startTrip: (input: NewTripInput) => Promise<Trip | null>
  updateTrip: (tripId: string, patch: UpdateTripInput) => Promise<void>
  deleteTrip: (tripId: string) => Promise<void>
  updateLeg: (legId: string, patch: UpdateLegInput) => Promise<void>
  mergeLegWithPrevious: (legId: string) => Promise<void>
  addEntry: (input: NewEntryInput) => Promise<LogEntry | null>
  updateEntry: (entryId: string, patch: UpdateEntryInput) => Promise<void>
  deleteEntry: (entryId: string) => Promise<void>
  attachMedia: (
    entryId: string,
    media: Omit<Media, 'id' | 'createdAt' | 'updatedAt' | 'synced'>,
  ) => Promise<Media | null>
  syncNow: () => Promise<boolean>
}

function nowIso() {
  return new Date().toISOString()
}

function makeId() {
  return crypto.randomUUID()
}

function sortEntries(entries: LogEntry[]) {
  return [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
}

function sortTrips(trips: Trip[]) {
  return [...trips].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

function resolveActiveTripId(trips: Trip[], current: string | null) {
  const activeTrip = trips.find((trip) => trip.status === 'IN_PROGRESS')
  if (activeTrip) return activeTrip.id
  if (current && trips.some((trip) => trip.id === current)) return current
  return null
}

function applySnapshot(set: (partial: Partial<LogbookState>) => void, snapshot: LogbookSnapshot, selectedTripId: string | null) {
  const sortedTrips = sortTrips(snapshot.trips)
  const sortedLegs = sortLegs(snapshot.legs ?? [])
  const sortedEntries = sortEntries(snapshot.logEntries)
  const activeTripId = resolveActiveTripId(sortedTrips, null)
  const nextSelected =
    selectedTripId && sortedTrips.some((trip) => trip.id === selectedTripId)
      ? selectedTripId
      : (activeTripId ?? sortedTrips.at(0)?.id ?? null)

  set({
    trips: sortedTrips,
    legs: sortedLegs,
    entries: sortedEntries,
    media: snapshot.media,
    activeTripId,
    selectedTripId: nextSelected,
  })
}

function syncStatusMessage(snapshot: LogbookSnapshot, online: boolean): string | null {
  if (!online) return 'Offline — will sync when back online'
  if (hasPendingSync(snapshot)) return 'Not synced'
  return null
}

async function flushLogbookSync(get: () => LogbookState) {
  let attempts = 0
  while (attempts < 8) {
    await get().syncNow()
    while (get().syncing) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    if (!get().syncQueued) break
    attempts += 1
  }
}

async function assertSyncedWhenOnline(get: () => LogbookState) {
  if (!get().online) return
  const snapshot = await loadLogbookSnapshot()
  if (!hasPendingSync(snapshot)) return
  throw new Error(get().syncMessage ?? 'Could not sync to server')
}

async function persistLegsAndEntries(legs: Leg[], entries: LogEntry[]) {
  await Promise.all([
    ...legs.filter((leg) => !leg.synced).map((leg) => putLeg(leg)),
    ...entries.filter((entry) => !entry.synced).map((entry) => putLogEntry(entry)),
  ])
}

async function applyTripLegRebuild(
  tripId: string,
  get: () => LogbookState,
  set: (partial: Partial<LogbookState> | ((state: LogbookState) => Partial<LogbookState>)) => void,
) {
  const previousLegIds = new Set(
    get().legs.filter((leg) => leg.tripId === tripId).map((leg) => leg.id),
  )
  const { legs, entries } = rebuildLegsForTrip(tripId, get().entries, get().legs)
  const nextLegIds = new Set(
    legs.filter((leg) => leg.tripId === tripId).map((leg) => leg.id),
  )
  for (const legId of previousLegIds) {
    if (!nextLegIds.has(legId)) {
      await deleteLeg(legId)
    }
  }
  await persistLegsAndEntries(
    legs.filter((leg) => leg.tripId === tripId),
    entries.filter((entry) => entry.tripId === tripId),
  )
  set({
    legs,
    entries: sortEntries(entries),
    syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
  })
}

async function applyTripOperationalSync(
  tripId: string,
  get: () => LogbookState,
  set: (partial: Partial<LogbookState> | ((state: LogbookState) => Partial<LogbookState>)) => void,
  patch: Partial<Trip> = {},
) {
  const trip = get().trips.find((item) => item.id === tripId)
  if (!trip) return

  const nextTrip = {
    ...syncTripOperationalFields(trip, get().entries.filter((entry) => entry.tripId === tripId)),
    ...patch,
    updatedAt: nowIso(),
  }

  await putTrip(nextTrip)
  addPendingTripId(tripId)
  set((state) => ({
    trips: state.trips.map((item) => (item.id === tripId ? nextTrip : item)),
    activeTripId:
      patch.status === 'IN_PROGRESS'
        ? tripId
        : patch.status === 'COMPLETED' && state.activeTripId === tripId
          ? null
          : state.activeTripId,
    syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
  }))
}

export const useLogbookStore = create<LogbookState>((set, get) => ({
  trips: [],
  legs: [],
  entries: [],
  media: [],
  activeTripId: null,
  selectedTripId: null,
  booted: false,
  syncing: false,
  syncQueued: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncMessage: null,

  load: async () => {
    const snapshot = await bootstrapLogbook()
    applySnapshot(set, snapshot, get().selectedTripId)
    set({
      booted: true,
      syncMessage: syncStatusMessage(snapshot, get().online),
    })
    if (get().online) {
      void get().syncNow()
    }
  },

  setOnline: (online) => {
    set({ online })
    if (online) {
      void get().syncNow()
    }
  },

  selectTrip: (tripId) => set({ selectedTripId: tripId }),

  startTrip: async (input) => {
    const context = await captureLogbookContext()
    const now = nowIso()
    const startedDate = new Date(context.timestamp)
    const trip: Trip = {
      id: makeId(),
      boatName: input.boatName.trim(),
      boatId: input.boatId ?? null,
      boatPhotoUrl: input.boatPhotoUrl ?? null,
      registration: input.registration?.trim() || null,
      skipper: input.skipper?.trim() || null,
      skipperKey: input.skipperKey ?? null,
      crewMemberIds: input.crewMemberIds?.length ? input.crewMemberIds : null,
      title: defaultTripTitle(input.boatName, startedDate),
      startedAt: context.timestamp,
      completedAt: null,
      startLatitude: context.latitude,
      startLongitude: context.longitude,
      startCountry: context.country,
      status: 'PLANNED',
      sailsUp: null,
      engineOn: null,
      moored: null,
      anchorDown: null,
      createdAt: now,
      updatedAt: now,
    }

    await putTrip(trip)
    addPendingTripId(trip.id)
    set((state) => ({
      trips: sortTrips([trip, ...state.trips]),
      selectedTripId: trip.id,
      syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
    }))

    await flushLogbookSync(get)
    try {
      await assertSyncedWhenOnline(get)
    } catch (error) {
      set({
        syncMessage:
          error instanceof Error ? error.message : 'Could not sync to server',
      })
    }
    return trip
  },

  updateTrip: async (tripId, patch) => {
    const current = get().trips.find((trip) => trip.id === tripId)
    if (!current) return
    const next: Trip = {
      ...current,
      ...patch,
      title:
        patch.title !== undefined
          ? patch.title?.trim() || null
          : current.title ?? null,
      crewMemberIds:
        patch.crewMemberIds !== undefined
          ? patch.crewMemberIds?.length
            ? patch.crewMemberIds
            : null
          : current.crewMemberIds ?? null,
      updatedAt: nowIso(),
    }
    await putTrip(next)
    addPendingTripId(tripId)
    set((state) => ({
      trips: state.trips.map((trip) => (trip.id === tripId ? next : trip)),
      syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
    }))
    void get().syncNow()
  },

  deleteTrip: async (tripId) => {
    const entries = get().entries.filter((entry) => entry.tripId === tripId)
    const tripLegs = get().legs.filter((leg) => leg.tripId === tripId)
    const entryIds = new Set(entries.map((entry) => entry.id))
    const media = get().media.filter((item) => entryIds.has(item.logEntryId))

    addPendingDeletedTripId(tripId)
    removePendingTripIds([tripId])
    await deleteTripFromIdb(tripId)
    await Promise.all([
      ...tripLegs.map((leg) => deleteLeg(leg.id)),
      ...entries.map((entry) => deleteLogEntry(entry.id)),
      ...media.map((item) => deleteMedia(item.id)),
    ])

    set((state) => {
      const trips = state.trips.filter((trip) => trip.id !== tripId)
      const nextSelected =
        state.selectedTripId === tripId
          ? (trips.find((trip) => trip.status === 'IN_PROGRESS')?.id ??
            trips.at(0)?.id ??
            null)
          : state.selectedTripId
      return {
        trips,
        legs: state.legs.filter((leg) => leg.tripId !== tripId),
        entries: state.entries.filter((entry) => entry.tripId !== tripId),
        media: state.media.filter((item) => !entryIds.has(item.logEntryId)),
        selectedTripId: nextSelected,
        activeTripId:
          state.activeTripId === tripId ? null : state.activeTripId,
        syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
      }
    })

    void get().syncNow()
  },

  updateLeg: async (legId, patch) => {
    const current = get().legs.find((leg) => leg.id === legId)
    if (!current) return
    const next: Leg = {
      ...current,
      ...patch,
      title:
        patch.title !== undefined ? patch.title?.trim() || null : current.title ?? null,
      updatedAt: nowIso(),
      synced: false,
    }
    await putLeg(next)
    set((state) => ({
      legs: state.legs.map((leg) => (leg.id === legId ? next : leg)),
      syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
    }))
    void get().syncNow()
  },

  mergeLegWithPrevious: async (legId) => {
    const leg = get().legs.find((item) => item.id === legId)
    if (!leg || leg.sequence === 0) return
    const previous = get().legs.find(
      (item) => item.tripId === leg.tripId && item.sequence === leg.sequence - 1,
    )
    if (!previous) return
    const result = mergeLegs(previous.id, leg.id, get().legs, get().entries)
    if (!result) return
    await Promise.all([
      deleteLeg(previous.id),
      deleteLeg(leg.id),
      ...result.legs.filter((l) => !l.synced).map((l) => putLeg(l)),
      ...result.entries.filter((e) => !e.synced).map((e) => putLogEntry(e)),
    ])
    set({
      legs: result.legs,
      entries: sortEntries(result.entries),
      syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
    })
    void get().syncNow()
  },

  addEntry: async (input) => {
    const hasPositionOverride =
      input.latitude != null && input.longitude != null
    const context = await captureLogbookContext(
      hasPositionOverride
        ? {
            latitude: input.latitude as number,
            longitude: input.longitude as number,
            accuracy: input.accuracy ?? null,
            heading: input.heading ?? null,
          }
        : undefined,
    )
    const entry: LogEntry = {
      id: makeId(),
      tripId: input.tripId,
      type: input.type,
      timestamp: input.timestamp ?? context.timestamp,
      latitude: context.latitude,
      longitude: context.longitude,
      accuracy: context.accuracy,
      heading: input.heading ?? context.heading ?? null,
      createdBy: 'captain',
      notes: input.notes?.trim() || null,
      data: input.data ?? null,
      weather: context.weather,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      synced: false,
      deleted: false,
    }

    await putLogEntry(entry)
    set((state) => ({
      entries: sortEntries([...state.entries, entry]),
      syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
    }))

    await applyTripLegRebuild(input.tripId, get, set)

    const trip = get().trips.find((item) => item.id === input.tripId)
    if (trip) {
      if (input.type === 'END_TRIP') {
        await applyTripOperationalSync(input.tripId, get, set, {
          status: 'COMPLETED',
          completedAt: entry.timestamp,
        })
      } else {
        const starting =
          trip.status === 'PLANNED'
            ? {
                status: 'IN_PROGRESS' as TripStatus,
                startedAt: entry.timestamp,
                startLatitude: context.latitude,
                startLongitude: context.longitude,
                startCountry: context.country,
              }
            : {}
        await applyTripOperationalSync(input.tripId, get, set, starting)
      }
    }

    await flushLogbookSync(get)
    try {
      await assertSyncedWhenOnline(get)
    } catch (error) {
      set({
        syncMessage:
          error instanceof Error ? error.message : 'Could not sync to server',
      })
    }
    return entry
  },

  updateEntry: async (entryId, patch) => {
    const current = get().entries.find((entry) => entry.id === entryId)
    if (!current) return
    const next = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
      synced: false,
    }
    await putLogEntry(next)
    set((state) => ({
      entries: sortEntries(
        state.entries.map((entry) => (entry.id === entryId ? next : entry)),
      ),
      syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
    }))
    await applyTripLegRebuild(current.tripId, get, set)
    await applyTripOperationalSync(current.tripId, get, set)
    void get().syncNow()
  },

  deleteEntry: async (entryId) => {
    const current = get().entries.find((entry) => entry.id === entryId)
    if (!current) return
    const next = {
      ...current,
      deleted: true,
      updatedAt: nowIso(),
      synced: false,
    }
    await putLogEntry(next)
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === entryId ? next : entry,
      ),
      syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
    }))
    await applyTripLegRebuild(current.tripId, get, set)
    await applyTripOperationalSync(current.tripId, get, set)
    void get().syncNow()
  },

  attachMedia: async (entryId, mediaInput) => {
    const current = get().entries.find((entry) => entry.id === entryId)
    if (!current) return null
    const media: Media = {
      id: makeId(),
      logEntryId: entryId,
      type: mediaInput.type,
      localPath: mediaInput.localPath ?? null,
      remoteUrl: mediaInput.remoteUrl ?? null,
      thumbnailUrl: mediaInput.thumbnailUrl ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      synced: false,
    }
    await putMedia(media)
    set((state) => ({
      media: [...state.media, media],
      syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
    }))
    void get().syncNow()
    return media
  },

  syncNow: async () => {
    if (get().syncing) {
      set({ syncQueued: true })
      return false
    }
    set({ syncing: true, syncMessage: 'Syncing…' })
    let success = true
    try {
      const result = await syncLogbook()
      if (result.ok) {
        applySnapshot(set, result.snapshot, get().selectedTripId)
        set({
          syncMessage: syncStatusMessage(result.snapshot, get().online),
        })
      } else {
        const snapshot = await loadLogbookSnapshot()
        set({
          syncMessage: syncStatusMessage(snapshot, get().online),
        })
        success = false
      }
    } catch (error) {
      const snapshot = await loadLogbookSnapshot()
      const message =
        error instanceof Error
          ? error.message
          : 'Sync failed'
      set({
        syncMessage: get().online ? message : syncStatusMessage(snapshot, get().online),
      })
      success = false
    } finally {
      const queued = get().syncQueued
      set({ syncing: false, syncQueued: false })
      if (queued) {
        void get().syncNow()
      }
    }
    return success && !hasPendingSync(await loadLogbookSnapshot())
  },
}))

export function triggerLogbookSyncRetry() {
  void useLogbookStore.getState().syncNow()
}
