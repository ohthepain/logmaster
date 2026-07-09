import { create } from 'zustand'
import type {
  LogEntry,
  LogEntryType,
  Media,
  Trip,
  TripStatus,
} from '../domain/logbook'
import { captureLogbookContext } from '../lib/logbook-context'
import { bootstrapLogbook, syncLogbook } from '../lib/logbook-sync'
import { putLogEntry, putMedia, putTrip } from '../lib/logbook-idb'

type NewTripInput = {
  boatName: string
  registration?: string
  skipper?: string
}

type NewEntryInput = {
  tripId: string
  type: LogEntryType
  notes?: string
  data?: Record<string, unknown>
  heading?: number | null
}

type UpdateEntryInput = Partial<
  Pick<LogEntry, 'notes' | 'data' | 'heading' | 'type' | 'deleted'>
>

type LogbookState = {
  trips: Trip[]
  entries: LogEntry[]
  media: Media[]
  activeTripId: string | null
  selectedTripId: string | null
  booted: boolean
  syncing: boolean
  online: boolean
  syncMessage: string | null
  load: () => Promise<void>
  setOnline: (online: boolean) => void
  selectTrip: (tripId: string | null) => void
  startTrip: (input: NewTripInput) => Promise<Trip | null>
  addEntry: (input: NewEntryInput) => Promise<LogEntry | null>
  updateEntry: (entryId: string, patch: UpdateEntryInput) => Promise<void>
  deleteEntry: (entryId: string) => Promise<void>
  nudgeEntryTime: (entryId: string, deltaMinutes: number) => Promise<void>
  attachMedia: (
    entryId: string,
    media: Omit<Media, 'id' | 'createdAt' | 'updatedAt' | 'synced'>,
  ) => Promise<Media | null>
  syncNow: () => Promise<void>
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

export const useLogbookStore = create<LogbookState>((set, get) => ({
  trips: [],
  entries: [],
  media: [],
  activeTripId: null,
  selectedTripId: null,
  booted: false,
  syncing: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncMessage: null,

  load: async () => {
    const snapshot = await bootstrapLogbook()
    const sortedTrips = [...snapshot.trips].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    const sortedEntries = sortEntries(snapshot.logEntries)
    const activeTrip = sortedTrips.find((trip) => trip.status === 'IN_PROGRESS')
    const firstTripId = sortedTrips.length > 0 ? sortedTrips[0].id : null
    set({
      trips: sortedTrips,
      entries: sortedEntries,
      media: snapshot.media,
      activeTripId: activeTrip?.id ?? null,
      selectedTripId: activeTrip?.id ?? firstTripId,
      booted: true,
    })
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void get().syncNow()
    }
  },

  setOnline: (online) => set({ online }),

  selectTrip: (tripId) => set({ selectedTripId: tripId }),

  startTrip: async (input) => {
    const context = await captureLogbookContext()
    const trip: Trip = {
      id: makeId(),
      boatName: input.boatName.trim(),
      registration: input.registration?.trim() || null,
      skipper: input.skipper?.trim() || null,
      startedAt: context.timestamp,
      completedAt: null,
      startLatitude: context.latitude,
      startLongitude: context.longitude,
      startCountry: context.country,
      status: 'IN_PROGRESS',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    await putTrip(trip)
    set((state) => {
      const trips = [trip, ...state.trips].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      return {
        trips,
        selectedTripId: trip.id,
        activeTripId: trip.id,
      }
    })

    await get().addEntry({
      tripId: trip.id,
      type: 'START_TRIP',
      notes: `${trip.boatName} started`,
      data: {
        registration: trip.registration,
        skipper: trip.skipper,
        startCountry: context.country,
      },
    })
    return trip
  },

  addEntry: async (input) => {
    const context = await captureLogbookContext()
    const entry: LogEntry = {
      id: makeId(),
      tripId: input.tripId,
      type: input.type,
      timestamp: context.timestamp,
      latitude: context.latitude,
      longitude: context.longitude,
      accuracy: context.accuracy,
      heading: input.heading ?? null,
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
      syncMessage: 'Saved locally',
    }))

    if (input.type === 'END_TRIP') {
      const trip = get().trips.find((t) => t.id === input.tripId)
      if (trip) {
        const completed = {
          ...trip,
          status: 'COMPLETED' as TripStatus,
          completedAt: entry.timestamp,
          updatedAt: nowIso(),
        }
        await putTrip(completed)
        set((state) => ({
          trips: state.trips.map((item) =>
            item.id === completed.id ? completed : item,
          ),
          activeTripId:
            state.activeTripId === completed.id ? null : state.activeTripId,
        }))
      }
    } else {
      const trip = get().trips.find((t) => t.id === input.tripId)
      if (trip) {
        const updated = { ...trip, updatedAt: nowIso() }
        await putTrip(updated)
        set((state) => ({
          trips: state.trips.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        }))
      }
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void get().syncNow()
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
      syncMessage: 'Saved locally',
    }))
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
      syncMessage: 'Saved locally',
    }))
  },

  nudgeEntryTime: async (entryId, deltaMinutes) => {
    const current = get().entries.find((entry) => entry.id === entryId)
    if (!current) return
    const timestamp = new Date(current.timestamp)
    timestamp.setMinutes(timestamp.getMinutes() + deltaMinutes)
    const next = {
      ...current,
      timestamp: timestamp.toISOString(),
      updatedAt: nowIso(),
      synced: false,
    }
    await putLogEntry(next)
    set((state) => ({
      entries: sortEntries(
        state.entries.map((entry) => (entry.id === entryId ? next : entry)),
      ),
    }))
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
    }))
    return media
  },

  syncNow: async () => {
    if (get().syncing) return
    set({ syncing: true, syncMessage: 'Syncing…' })
    try {
      const result = await syncLogbook()
      set({
        syncing: false,
        syncMessage: result.ok ? 'Synced' : 'Saved locally',
      })
    } catch (error) {
      set({
        syncing: false,
        syncMessage:
          error instanceof Error ? error.message : 'Sync failed, saved locally',
      })
    }
  },
}))
