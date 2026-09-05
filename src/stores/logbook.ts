import { create } from 'zustand'
import type {
  Leg,
  LogEntry,
  LogEntryType,
  Media,
  Trip,
  TripStatus,
} from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { normalizeTripTrack } from '../domain/trip-track'
import { getTripTrackRecorder, isOpenPositionTrack, openPositionTrackId } from '../lib/trip-track-recorder'
import { hydrateTripTrackPayload, fetchTripTrackManifests, mergeTrackManifests } from '../lib/trip-track-sync'
import {
  captureLogbookContext,
  fetchLogbookLocationContext,
  readDevicePosition,
} from '../lib/logbook-context'
import { attachPlaceToEntryData } from '../lib/logbook-place'
import { defaultTripTitle } from '../lib/trip-display'
import {
  bootstrapLogbook,
  hasPendingSync,
  syncLogbook,
  type SyncLogbookOptions,
} from '../lib/logbook-sync'
import type { LogbookSnapshot } from '../lib/logbook-sync'
import {
  mergeLegs,
  rebuildLegsForTrip,
  sortLegs,
} from '../lib/trip-legs'
import { withHumanEditedFlag } from '../domain/instrument-data'
import { syncTripOperationalFields } from '../domain/trip-state'
import {
  nextContentOrder,
  readNoteOrder,
  readVoiceOrder,
} from '../lib/log-entry-content-order'
import { advanceIso, effectiveTimeTravelIso } from '../lib/dev-time-travel'
import { isDevModeAvailable } from '../lib/dev-mode'
import { sortLogEntriesChronologically } from '../lib/logbook-entry-order'
import {
  appendNote,
  buildPromotedMediaEntryInput,
  isPromotableMedia,
  resolvePhotoVideoSave,
} from '../lib/media-entry'
import { buildTripFromGpxFiles } from '../lib/gpx-trip-import'
import { buildTripFromSignalK } from '../lib/signalk-trip-import'
import { GpxImportError, partitionGpxImportFiles, type GpxImportFile } from '../lib/gpx-import'
import { SignalKImportError } from '../lib/signalk-import'
import {
  addPendingDeletedTripId,
  addPendingDeletedMediaId,
  addPendingTripId,
  deleteLeg,
  deleteLogEntry,
  deleteMedia,
  deleteTrip as deleteTripFromIdb,
  deleteTripTrack,
  loadLogbookSnapshot,
  putLeg,
  putLogEntry,
  putMedia,
  putTrip,
  putTripTrack,
  removePendingTripIds,
} from '../lib/logbook-idb'
import { useAppOptionsStore } from './app-options'

const DEV_ENTRY_TIME_ADVANCE_MS = 60 * 60 * 1000

type NewTripInput = {
  boatName: string
  boatId?: string | null
  boatPhotoUrl?: string | null
  boatIconId?: string | null
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
  legId?: string | null
}

type SavePhotoVideoInput = {
  tripId: string
  fileName: string
  mimeType: string
  size: number
  thumbnailUrl: string | null
  remoteUrl?: string | null
  capturePosition: { latitude: number; longitude: number } | null
  timestamp?: string
  note?: string
  attachEntryId?: string
  excludeEntryId?: string
  order?: number
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
    | 'subtitle'
    | 'coverPhotoDataUrl'
    | 'coverKind'
    | 'boatName'
    | 'registration'
    | 'skipper'
    | 'crewMemberIds'
    | 'sailsUp'
    | 'engineOn'
    | 'moored'
    | 'anchorDown'
  >
>

type UpdateLegInput = Partial<Pick<Leg, 'title' | 'color'>>

type LogbookWriteOptions = {
  skipSync?: boolean
}

type LogbookState = {
  trips: Trip[]
  legs: Leg[]
  entries: LogEntry[]
  tracks: TripTrack[]
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
  addEntry: (
    input: NewEntryInput,
    options?: LogbookWriteOptions,
  ) => Promise<LogEntry | null>
  updateEntry: (
    entryId: string,
    patch: UpdateEntryInput,
    options?: LogbookWriteOptions,
  ) => Promise<void>
  deleteEntry: (entryId: string) => Promise<void>
  attachMedia: (
    entryId: string,
    media: Omit<Media, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'order'> & {
      order?: number
    },
    options?: LogbookWriteOptions,
  ) => Promise<Media | null>
  savePhotoVideo: (
    input: SavePhotoVideoInput,
    options?: LogbookWriteOptions,
  ) => Promise<{ entry: LogEntry | null; media: Media | null; attached: boolean }>
  removeMedia: (mediaId: string) => Promise<void>
  updateMedia: (
    mediaId: string,
    patch: Partial<
      Pick<Media, 'logEntryId' | 'localPath' | 'remoteUrl' | 'thumbnailUrl' | 'order'>
    >,
    options?: LogbookWriteOptions,
  ) => Promise<void>
  syncNow: (options?: SyncLogbookOptions) => Promise<boolean>
  upsertTripTracks: (tracks: TripTrack[]) => Promise<void>
  appendTripTrackPosition: (
    tripId: string,
    sample: {
      time: string
      latitude: number
      longitude: number
      heading?: number | null
      elevationM?: number | null
    },
    options?: { source?: TripTrack['source']; legId?: string | null },
  ) => Promise<void>
  ensureTripTrackPayloads: (tripId: string) => Promise<void>
  importTripFromGpx: (
    gpxXml: string,
    options?: { boatName?: string; fileName?: string },
  ) => Promise<Trip>
  importTripFromGpxFiles: (
    files: GpxImportFile[],
    options?: { boatName?: string },
  ) => Promise<Trip>
  importTripFromSignalK: (
    json: string,
    options?: { boatName?: string; fileName?: string },
  ) => Promise<Trip>
  autoMapCoverTripIds: string[]
  requestAutoMapCover: (tripId: string) => void
  clearAutoMapCoverRequest: (tripId: string) => void
}

function nowIso() {
  return new Date().toISOString()
}

function makeId() {
  return crypto.randomUUID()
}

function sortEntries(entries: LogEntry[]) {
  return sortLogEntriesChronologically(entries)
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
    tracks: snapshot.tripTracks ?? [],
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

function scheduleBackgroundSync(
  get: () => LogbookState,
  options?: SyncLogbookOptions,
) {
  void get().syncNow(options)
}

async function captureEntryContext(input: NewEntryInput) {
  const hasPositionOverride =
    input.latitude != null && input.longitude != null

  if (hasPositionOverride) {
    const [context, entryData] = await Promise.all([
      captureLogbookContext({
        latitude: input.latitude as number,
        longitude: input.longitude as number,
        accuracy: input.accuracy ?? null,
        heading: input.heading ?? null,
      }),
      attachPlaceToEntryData(input.data, input.latitude, input.longitude),
    ])
    return { context, entryData }
  }

  const gps = await readDevicePosition()
  if (gps.latitude == null || gps.longitude == null) {
    const entryData = await attachPlaceToEntryData(input.data, null, null)
    return {
      context: {
        ...gps,
        country: null,
        weather: null,
      },
      entryData,
    }
  }

  const [locationContext, entryData] = await Promise.all([
    fetchLogbookLocationContext(gps.latitude, gps.longitude),
    attachPlaceToEntryData(input.data, gps.latitude, gps.longitude),
  ])

  return {
    context: {
      ...gps,
      country: locationContext.country ?? null,
      weather: locationContext.weather ?? null,
    },
    entryData,
  }
}

async function persistLegsAndEntries(legs: Leg[], entries: LogEntry[]) {
  await Promise.all([
    ...legs.filter((leg) => !leg.synced).map((leg) => putLeg(leg)),
    ...entries.filter((entry) => !entry.synced).map((entry) => putLogEntry(entry)),
  ])
}

type ImportedTripBundle = {
  trip: Trip
  entries: LogEntry[]
  tracks: TripTrack[]
  legs: Leg[]
}

async function persistImportedTrip(
  get: () => LogbookState,
  set: (partial: Partial<LogbookState> | ((state: LogbookState) => Partial<LogbookState>)) => void,
  imported: ImportedTripBundle,
): Promise<Trip> {
  const { trip, entries, tracks, legs: tripLegs } = imported

  await putTrip(trip)
  await Promise.all(tracks.map((track) => putTripTrack(track)))
  await Promise.all(entries.map((entry) => putLogEntry(entry)))
  await persistLegsAndEntries(
    tripLegs,
    entries.filter((entry) => entry.tripId === trip.id),
  )
  addPendingTripId(trip.id)

  set((state) => ({
    trips: sortTrips([trip, ...state.trips]),
    legs: [...state.legs.filter((leg) => leg.tripId !== trip.id), ...tripLegs],
    entries: sortEntries([...state.entries, ...entries]),
    tracks: [...state.tracks, ...tracks],
    selectedTripId: trip.id,
    syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
    autoMapCoverTripIds: state.autoMapCoverTripIds.includes(trip.id)
      ? state.autoMapCoverTripIds
      : [...state.autoMapCoverTripIds, trip.id],
  }))

  scheduleBackgroundSync(get, { skipBootstrap: true })
  return trip
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
  tracks: [],
  media: [],
  activeTripId: null,
  selectedTripId: null,
  booted: false,
  syncing: false,
  syncQueued: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncMessage: null,
  autoMapCoverTripIds: [],

  load: async () => {
    if (get().booted) {
      if (get().online) {
        void get().syncNow()
      }
      return
    }
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
      boatIconId: input.boatIconId ?? null,
      registration: input.registration?.trim() || null,
      skipper: input.skipper?.trim() || null,
      skipperKey: input.skipperKey ?? null,
      crewMemberIds: input.crewMemberIds?.length ? input.crewMemberIds : null,
      title: defaultTripTitle(input.boatName, startedDate),
      coverKind: 'map',
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

    scheduleBackgroundSync(get, { skipBootstrap: true, skipTracks: true })
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
      subtitle:
        patch.subtitle !== undefined
          ? patch.subtitle?.trim() || null
          : current.subtitle ?? null,
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
    void get().syncNow({ skipBootstrap: true })
  },

  deleteTrip: async (tripId) => {
    const entries = get().entries.filter((entry) => entry.tripId === tripId)
    const tripTracks = get().tracks.filter((track) => track.tripId === tripId)
    const tripLegs = get().legs.filter((leg) => leg.tripId === tripId)
    const entryIds = new Set(entries.map((entry) => entry.id))
    const media = get().media.filter((item) => entryIds.has(item.logEntryId))

    addPendingDeletedTripId(tripId)
    removePendingTripIds([tripId])
    await deleteTripFromIdb(tripId)
    await Promise.all([
      ...tripLegs.map((leg) => deleteLeg(leg.id)),
      ...entries.map((entry) => deleteLogEntry(entry.id)),
      ...tripTracks.map((track) => deleteTripTrack(track.id)),
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
        tracks: state.tracks.filter((track) => track.tripId !== tripId),
        media: state.media.filter((item) => !entryIds.has(item.logEntryId)),
        selectedTripId: nextSelected,
        activeTripId:
          state.activeTripId === tripId ? null : state.activeTripId,
        syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
      }
    })

    void get().syncNow({ skipBootstrap: true })
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
    void get().syncNow({ skipBootstrap: true })
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
    void get().syncNow({ skipBootstrap: true })
  },

  addEntry: async (input, options) => {
    const { context, entryData } = await captureEntryContext(input)
    const {
      devMode,
      devTimeTravelEnabled,
      devLogEntryDraftTimeIso,
      devTimeTravelAnchorRealIso,
      devTripReplay,
      setDevLogEntryDraftTimeIso,
    } = useAppOptionsStore.getState()
    const useDraftTimestamp =
      input.timestamp == null &&
      input.type !== 'START_TRIP' &&
      input.type !== 'END_TRIP' &&
      devMode &&
      devTimeTravelEnabled &&
      isDevModeAvailable() &&
      devLogEntryDraftTimeIso != null
    const timestamp = useDraftTimestamp
      ? devTripReplay
        ? effectiveTimeTravelIso(
            devLogEntryDraftTimeIso,
            devTimeTravelAnchorRealIso,
          )
        : devLogEntryDraftTimeIso
      : (input.timestamp ?? context.timestamp)
    const entry: LogEntry = {
      id: makeId(),
      tripId: input.tripId,
      legId: input.legId ?? null,
      type: input.type,
      timestamp,
      latitude: context.latitude,
      longitude: context.longitude,
      accuracy: context.accuracy,
      heading: input.heading ?? context.heading ?? null,
      createdBy: 'captain',
      notes: input.notes?.trim() || null,
      data: entryData,
      weather: context.weather,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      synced: false,
      deleted: false,
    }

    await putLogEntry(entry)
    if (useDraftTimestamp) {
      setDevLogEntryDraftTimeIso(
        advanceIso(timestamp, DEV_ENTRY_TIME_ADVANCE_MS),
      )
    }
    set((state) => ({
      entries: sortEntries([...state.entries, entry]),
      syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
    }))

    await applyTripLegRebuild(input.tripId, get, set)

    const trip = get().trips.find((item) => item.id === input.tripId)
    if (trip) {
      if (input.type === 'END_TRIP') {
        await get().upsertTripTracks(getTripTrackRecorder().sealTrip(input.tripId))
        getTripTrackRecorder().clearTrip(input.tripId)
        await deleteTripTrack(openPositionTrackId(input.tripId))
        set((state) => ({
          tracks: state.tracks.filter(
            (track) =>
              !(track.tripId === input.tripId && isOpenPositionTrack(track)),
          ),
        }))
        await applyTripOperationalSync(input.tripId, get, set, {
          status: 'COMPLETED',
          completedAt: entry.timestamp,
        })
        get().requestAutoMapCover(input.tripId)
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

    if (!options?.skipSync) {
      scheduleBackgroundSync(get, { skipBootstrap: true, skipTracks: true })
    }
    return entry
  },

  updateEntry: async (entryId, patch, options) => {
    const current = get().entries.find((entry) => entry.id === entryId)
    if (!current) return

    const latitude =
      patch.latitude !== undefined ? patch.latitude : current.latitude
    const longitude =
      patch.longitude !== undefined ? patch.longitude : current.longitude
    const positionChanged =
      (patch.latitude !== undefined && patch.latitude !== current.latitude) ||
      (patch.longitude !== undefined && patch.longitude !== current.longitude)
    let data =
      patch.data !== undefined ? patch.data : (current.data ?? null)

    if (positionChanged) {
      data = await attachPlaceToEntryData(data, latitude, longitude)
    }

    data = withHumanEditedFlag(data)

    const notes = patch.notes !== undefined ? patch.notes : current.notes
    const sameNotes = notes === current.notes
    const sameLat = latitude === current.latitude
    const sameLng = longitude === current.longitude
    const sameData =
      JSON.stringify(data ?? null) === JSON.stringify(current.data ?? null)
    if (sameNotes && sameLat && sameLng && sameData) {
      return
    }

    const next = {
      ...current,
      ...patch,
      notes,
      latitude,
      longitude,
      data,
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
    if (!options?.skipSync) {
      void get().syncNow({ skipBootstrap: true })
    }
  },

  deleteEntry: async (entryId) => {
    const current = get().entries.find((entry) => entry.id === entryId)
    if (!current) return

    if (current.type !== 'MEDIA') {
      const entryMedia = get().media.filter((item) => item.logEntryId === entryId)
      for (const item of entryMedia) {
        if (!isPromotableMedia(item)) continue

        const promotedEntry = await get().addEntry(
          {
            ...buildPromotedMediaEntryInput(current, item),
            legId: current.legId ?? null,
          },
          { skipSync: true },
        )
        if (!promotedEntry) continue

        await get().updateMedia(
          item.id,
          { logEntryId: promotedEntry.id },
          { skipSync: true },
        )
      }
    }

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
    void get().syncNow({ skipBootstrap: true })
  },

  savePhotoVideo: async (input, options) => {
    const tripEntries = get().entries.filter(
      (entry) => entry.tripId === input.tripId && !entry.deleted,
    )
    const resolution = resolvePhotoVideoSave({
      tripId: input.tripId,
      tripEntries,
      capturePosition: input.capturePosition,
      attachEntryId: input.attachEntryId,
      excludeEntryId: input.excludeEntryId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.size,
      timestamp: input.timestamp,
    })

    if (resolution.action === 'attach') {
      const target = get().entries.find((entry) => entry.id === resolution.entryId)
      if (input.note?.trim() && target) {
        await get().updateEntry(
          resolution.entryId,
          {
            notes: appendNote(target.notes, input.note),
          },
          { skipSync: true },
        )
      }

      const media = await get().attachMedia(
        resolution.entryId,
        {
          logEntryId: resolution.entryId,
          type: 'photo',
          localPath: input.fileName,
          remoteUrl: input.remoteUrl ?? null,
          thumbnailUrl: input.thumbnailUrl,
          order: input.order,
        },
        options,
      )
      return {
        entry: get().entries.find((entry) => entry.id === resolution.entryId) ?? null,
        media,
        attached: true,
      }
    }

    const entry = await get().addEntry(resolution.entryInput, { skipSync: true })
    if (!entry) {
      return { entry: null, media: null, attached: false }
    }

    const media = await get().attachMedia(
      entry.id,
      {
        logEntryId: entry.id,
        type: 'photo',
        localPath: input.fileName,
        remoteUrl: input.remoteUrl ?? null,
        thumbnailUrl: input.thumbnailUrl,
        order: input.order,
      },
      options,
    )

    if (!options?.skipSync) {
      void get().syncNow({ skipBootstrap: true })
    }

    return { entry, media, attached: false }
  },

  attachMedia: async (entryId, mediaInput, options) => {
    const current = get().entries.find((entry) => entry.id === entryId)
    if (!current) return null
    const entryMedia = get().media.filter((item) => item.logEntryId === entryId)
    const order =
      mediaInput.order ??
      nextContentOrder({
        media: entryMedia,
        noteOrder: readNoteOrder(current.data),
        voiceOrder: readVoiceOrder(current.data),
      })
    const media: Media = {
      id: makeId(),
      logEntryId: entryId,
      type: mediaInput.type,
      order,
      localPath: mediaInput.localPath ?? null,
      remoteUrl: mediaInput.remoteUrl ?? null,
      thumbnailUrl: mediaInput.thumbnailUrl ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      synced: false,
    }
    await putMedia(media)
    const currentData = withHumanEditedFlag(current.data)
    if (currentData !== current.data) {
      const nextEntry = {
        ...current,
        data: currentData,
        updatedAt: nowIso(),
        synced: false,
      }
      await putLogEntry(nextEntry)
      set((state) => ({
        media: [...state.media, media],
        entries: sortEntries(
          state.entries.map((entry) =>
            entry.id === entryId ? nextEntry : entry,
          ),
        ),
        syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
      }))
    } else {
      set((state) => ({
        media: [...state.media, media],
        syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
      }))
    }
    if (!options?.skipSync) {
      void get().syncNow()
    }
    return media
  },

  removeMedia: async (mediaId) => {
    const item = get().media.find((candidate) => candidate.id === mediaId)
    if (!item) return

    await deleteMedia(mediaId)
    if (item.synced) {
      addPendingDeletedMediaId(mediaId)
    }

    const current = get().entries.find((entry) => entry.id === item.logEntryId)
    if (current) {
      const nextEntry = {
        ...current,
        data: withHumanEditedFlag(current.data),
        updatedAt: nowIso(),
        synced: false,
      }
      await putLogEntry(nextEntry)
      set((state) => ({
        media: state.media.filter((candidate) => candidate.id !== mediaId),
        entries: sortEntries(
          state.entries.map((entry) =>
            entry.id === current.id ? nextEntry : entry,
          ),
        ),
        syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
      }))
    } else {
      set((state) => ({
        media: state.media.filter((candidate) => candidate.id !== mediaId),
        syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
      }))
    }

    void get().syncNow({ skipBootstrap: true })
  },

  updateMedia: async (mediaId, patch, options) => {
    const item = get().media.find((candidate) => candidate.id === mediaId)
    if (!item) return

    const next: Media = {
      ...item,
      ...patch,
      updatedAt: nowIso(),
      synced: false,
    }
    await putMedia(next)

    const current = get().entries.find((entry) => entry.id === item.logEntryId)
    if (current) {
      const nextEntry = {
        ...current,
        data: withHumanEditedFlag(current.data),
        updatedAt: nowIso(),
        synced: false,
      }
      await putLogEntry(nextEntry)
      set((state) => ({
        media: state.media.map((candidate) =>
          candidate.id === mediaId ? next : candidate,
        ),
        entries: sortEntries(
          state.entries.map((entry) =>
            entry.id === current.id ? nextEntry : entry,
          ),
        ),
        syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
      }))
    } else {
      set((state) => ({
        media: state.media.map((candidate) =>
          candidate.id === mediaId ? next : candidate,
        ),
        syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
      }))
    }

    if (!options?.skipSync) {
      void get().syncNow({ skipBootstrap: true })
    }
  },

  importTripFromGpx: async (gpxXml, options) => {
    return get().importTripFromGpxFiles([{ gpxXml, fileName: options?.fileName }], {
      boatName: options?.boatName,
    })
  },

  importTripFromGpxFiles: async (files, options) => {
    const { tripFiles } = partitionGpxImportFiles(files)
    if (tripFiles.length === 0) {
      throw new GpxImportError('No GPX track files were found in that selection.')
    }

    let imported: ReturnType<typeof buildTripFromGpxFiles>
    try {
      imported = buildTripFromGpxFiles(tripFiles, options)
    } catch (error) {
      if (error instanceof GpxImportError) throw error
      throw new GpxImportError(
        error instanceof Error ? error.message : 'Could not import GPX file',
      )
    }

    return persistImportedTrip(get, set, imported)
  },

  importTripFromSignalK: async (json, options) => {
    let imported: ReturnType<typeof buildTripFromSignalK>
    try {
      imported = buildTripFromSignalK(json, options)
    } catch (error) {
      if (error instanceof SignalKImportError) throw error
      throw new SignalKImportError(
        error instanceof Error ? error.message : 'Could not import Signal K file',
      )
    }

    return persistImportedTrip(get, set, imported)
  },

  requestAutoMapCover: (tripId) => {
    set((state) => ({
      autoMapCoverTripIds: state.autoMapCoverTripIds.includes(tripId)
        ? state.autoMapCoverTripIds
        : [...state.autoMapCoverTripIds, tripId],
    }))
  },

  clearAutoMapCoverRequest: (tripId) => {
    set((state) => ({
      autoMapCoverTripIds: state.autoMapCoverTripIds.filter((id) => id !== tripId),
    }))
  },

  upsertTripTracks: async (tracks) => {
    if (tracks.length === 0) return
    const normalized = tracks.map((track) => normalizeTripTrack(track))
    await Promise.all(normalized.map((track) => putTripTrack(track)))
    const tripIds = new Set(normalized.map((track) => track.tripId))
    for (const tripId of tripIds) {
      addPendingTripId(tripId)
    }
    set((state) => {
      const byId = new Map(state.tracks.map((track) => [track.id, track]))
      for (const track of normalized) {
        byId.set(track.id, track)
      }
      return {
        tracks: [...byId.values()].sort(
          (a, b) =>
            new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
        ),
        syncMessage: get().online ? 'Syncing…' : 'Offline — will sync when back online',
      }
    })
    void get().syncNow({ skipBootstrap: true })
  },

  appendTripTrackPosition: async (tripId, sample, options) => {
    const recorder = getTripTrackRecorder()
    const sealed = recorder.appendPositionSample(tripId, sample, {
      source: options?.source ?? 'background-gps',
      legId: options?.legId ?? null,
    })
    const openTrack = recorder.openPositionTrack(tripId)

    set((state) => {
      const byId = new Map(
        state.tracks
          .filter((track) => !isOpenPositionTrack(track) || track.tripId !== tripId)
          .map((track) => [track.id, track]),
      )
      for (const track of sealed) {
        byId.set(track.id, track)
      }
      if (openTrack) {
        byId.set(openTrack.id, openTrack)
      }
      return {
        tracks: [...byId.values()].sort(
          (a, b) =>
            new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
        ),
      }
    })

    if (sealed.length > 0) {
      await get().upsertTripTracks(sealed)
    } else if (openTrack) {
      await putTripTrack(openTrack)
    }
  },

  ensureTripTrackPayloads: async (tripId) => {
    let tracks = get().tracks.filter((track) => track.tripId === tripId)
    if (get().online) {
      try {
        const manifests = await fetchTripTrackManifests(tripId)
        const merged = mergeTrackManifests(tracks, manifests)
        set((state) => {
          const byId = new Map(state.tracks.map((track) => [track.id, track]))
          for (const track of merged) {
            byId.set(track.id, track)
          }
          return { tracks: [...byId.values()] }
        })
        tracks = merged
      } catch {
        // Keep local manifests when the track API is unavailable.
      }
    }

    const missing = tracks.filter(
      (track) => track.storage === 's3' && track.payload == null,
    )
    if (missing.length === 0) return
    const hydrated = await Promise.all(
      missing.map((track) => hydrateTripTrackPayload(track)),
    )
    set((state) => {
      const byId = new Map(state.tracks.map((track) => [track.id, track]))
      for (const track of hydrated) {
        byId.set(track.id, track)
      }
      return { tracks: [...byId.values()] }
    })
  },

  syncNow: async (options?: SyncLogbookOptions) => {
    if (get().syncing) {
      set({ syncQueued: true })
      return false
    }
    set({ syncing: true, syncMessage: 'Syncing…' })
    let success = true
    try {
      const result = await syncLogbook(options)
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
        void get().syncNow(options)
      } else if (options?.skipTracks) {
        const snapshot = await loadLogbookSnapshot()
        const pendingTracks = (snapshot.tripTracks ?? []).filter((track) => !track.synced)
        if (pendingTracks.length > 0) {
          void get().syncNow({ skipBootstrap: true, skipTracks: false })
        }
      }
    }
    return success && !hasPendingSync(await loadLogbookSnapshot())
  },
}))

export function triggerLogbookSyncRetry() {
  void useLogbookStore.getState().syncNow()
}
