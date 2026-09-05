import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  pauseDevTripRetripState,
  resumeDevTripRetripState,
  retripWithTimescale,
  type DevTripRetrip,
} from '../lib/dev-trip-retrip'
import {
  clearDevPositionOverride,
  setLocationAccessEnabled,
} from '../lib/device-position'
import { defaultMapBasemapLayerToggles } from '../lib/maplibre-basemap-layer-toggles'
import type { MapBasemapLayerToggles } from '../lib/maplibre-basemap-layer-toggles'
import {
  defaultMapDataLayerToggles,
  mergeMapDataLayerToggles,
  
} from '../lib/map-data-layers'
import type {MapDataLayerToggles} from '../lib/map-data-layers';
import {
  defaultMapLogEntryLayerToggles,
  mergeMapLogEntryLayerToggles,
} from '../lib/map-log-entry-layers'
import type { MapLogEntryLayerToggles } from '../lib/map-log-entry-layers'

export type DevTripReplay = {
  sourceTripId: string
  targetTripId: string
  targetStartedAt: string
  realStartedAt: string
}

export type { DevTripRetrip } from '../lib/dev-trip-retrip'

type AppOptions = {
  devMode: boolean
  setDevMode: (v: boolean) => void
  /** Dev mode: remembered entry time for the log-entry create modal only. */
  devLogEntryDraftTimeIso: string | null
  setDevLogEntryDraftTimeIso: (iso: string | null) => void
  /** Real clock time when the time-travel value was selected. */
  devTimeTravelAnchorRealIso: string | null
  /** Dev mode: when on, new log entries use devLogEntryDraftTimeIso. */
  devTimeTravelEnabled: boolean
  setDevTimeTravelEnabled: (enabled: boolean) => void
  /** Active real-time replay of a completed trip. */
  devTripReplay: DevTripReplay | null
  setDevTripReplay: (replay: DevTripReplay | null) => void
  /** Dev mode: global instrument spoofing from a completed trip. */
  devTripRetrip: DevTripRetrip | null
  setDevTripRetrip: (retrip: DevTripRetrip | null) => void
  pauseDevTripRetrip: () => void
  resumeDevTripRetrip: () => void
  setDevTripRetripTimescale: (timescale: number) => void
  stopDevTripRetrip: () => void
  lastTripBoatId: string | null
  setLastTripBoatId: (boatId: string | null) => void
  /** Native app: record GPS in background while a trip is in progress. */
  backgroundTripRecording: boolean
  setBackgroundTripRecording: (enabled: boolean) => void
  /** Trip currently recording GPS. Location permission is only requested for this trip. */
  recordingTripId: string | null
  setRecordingTripId: (tripId: string | null) => void
  /** Minimum minutes between auto-tracked log entries. */
  autoTrackIntervalMinutes: number
  setAutoTrackIntervalMinutes: (minutes: number) => void
  /** Also create an entry after moving at least this many metres. */
  autoTrackMinDistanceMeters: number
  setAutoTrackMinDistanceMeters: (meters: number) => void
  /** Basemap: POI/building/transit/landuse visibility (heuristic layer ids). */
  mapBasemapLayerToggles: MapBasemapLayerToggles
  setMapBasemapLayerToggles: (next: Partial<MapBasemapLayerToggles>) => void
  /** Vector map data overlays (marinas, seamarks, place labels, …). */
  mapDataLayerToggles: MapDataLayerToggles
  setMapDataLayerToggles: (next: Partial<MapDataLayerToggles>) => void
  /** Log entry markers on trip maps. */
  mapLogEntryLayerToggles: MapLogEntryLayerToggles
  setMapLogEntryLayerToggles: (next: Partial<MapLogEntryLayerToggles>) => void
}

export const useAppOptionsStore = create<AppOptions>()(
  persist(
    (set, get) => ({
      devMode: false,
      devLogEntryDraftTimeIso: null,
      devTimeTravelAnchorRealIso: null,
      devTimeTravelEnabled: false,
      devTripReplay: null,
      devTripRetrip: null,
      setDevMode: (v) => {
        if (!v) {
          const replayTargetId = get().devTripReplay?.targetTripId
          const recordingTripId =
            get().recordingTripId === replayTargetId
              ? null
              : get().recordingTripId
          clearDevPositionOverride()
          setLocationAccessEnabled(Boolean(recordingTripId))
          set({
            devMode: v,
            devLogEntryDraftTimeIso: null,
            devTimeTravelAnchorRealIso: null,
            devTimeTravelEnabled: false,
            devTripReplay: null,
            devTripRetrip: null,
            recordingTripId,
          })
          return
        }
        set({ devMode: v })
      },
      setDevLogEntryDraftTimeIso: (iso) =>
        set({
          devLogEntryDraftTimeIso: iso,
          devTimeTravelAnchorRealIso: iso ? new Date().toISOString() : null,
        }),
      setDevTimeTravelEnabled: (enabled) => set({ devTimeTravelEnabled: enabled }),
      setDevTripReplay: (devTripReplay) => set({ devTripReplay }),
      setDevTripRetrip: (devTripRetrip) => set({ devTripRetrip }),
      pauseDevTripRetrip: () => {
        const retrip = get().devTripRetrip
        if (!retrip || retrip.paused) return
        set({ devTripRetrip: pauseDevTripRetripState(retrip) })
      },
      resumeDevTripRetrip: () => {
        const retrip = get().devTripRetrip
        if (!retrip || !retrip.paused) return
        set({ devTripRetrip: resumeDevTripRetripState(retrip) })
      },
      setDevTripRetripTimescale: (timescale) => {
        const retrip = get().devTripRetrip
        if (!retrip) return
        set({ devTripRetrip: retripWithTimescale(retrip, timescale, Date.now()) })
      },
      stopDevTripRetrip: () => {
        clearDevPositionOverride()
        set({ devTripRetrip: null })
      },
      lastTripBoatId: null,
      setLastTripBoatId: (boatId) => set({ lastTripBoatId: boatId }),
      backgroundTripRecording: true,
      setBackgroundTripRecording: (enabled) =>
        set({ backgroundTripRecording: enabled }),
      recordingTripId: null,
      setRecordingTripId: (tripId) => {
        setLocationAccessEnabled(Boolean(tripId))
        set({ recordingTripId: tripId })
      },
      autoTrackIntervalMinutes: 30,
      setAutoTrackIntervalMinutes: (minutes) =>
        set({
          autoTrackIntervalMinutes: Math.max(5, Math.round(minutes)),
        }),
      autoTrackMinDistanceMeters: 500,
      setAutoTrackMinDistanceMeters: (meters) =>
        set({
          autoTrackMinDistanceMeters: Math.max(50, Math.round(meters)),
        }),
      mapBasemapLayerToggles: defaultMapBasemapLayerToggles(),
      setMapBasemapLayerToggles: (next: Partial<MapBasemapLayerToggles>) =>
        set((s) => ({
          mapBasemapLayerToggles: { ...s.mapBasemapLayerToggles, ...next },
        })),
      mapDataLayerToggles: defaultMapDataLayerToggles(),
      setMapDataLayerToggles: (next: Partial<MapDataLayerToggles>) =>
        set((s) => ({
          mapDataLayerToggles: { ...s.mapDataLayerToggles, ...next },
        })),
      mapLogEntryLayerToggles: defaultMapLogEntryLayerToggles(),
      setMapLogEntryLayerToggles: (next: Partial<MapLogEntryLayerToggles>) =>
        set((s) => ({
          mapLogEntryLayerToggles: { ...s.mapLogEntryLayerToggles, ...next },
        })),
    }),
    {
      name: 'travelmode-app-options',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.mapLogEntryLayerToggles = mergeMapLogEntryLayerToggles(
            state.mapLogEntryLayerToggles,
          )
          state.mapDataLayerToggles = mergeMapDataLayerToggles(
            state.mapDataLayerToggles,
          )
        }
        setLocationAccessEnabled(Boolean(state?.recordingTripId))
      },
    },
  ),
)
