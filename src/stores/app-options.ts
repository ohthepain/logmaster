import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clearDevPositionOverride } from '../lib/device-position'
import { defaultMapBasemapLayerToggles } from '../lib/maplibre-basemap-layer-toggles'
import type { MapBasemapLayerToggles } from '../lib/maplibre-basemap-layer-toggles'

type AppOptions = {
  devMode: boolean
  setDevMode: (v: boolean) => void
  /** Dev mode: remembered entry time for the log-entry create modal only. */
  devLogEntryDraftTimeIso: string | null
  setDevLogEntryDraftTimeIso: (iso: string | null) => void
  /** Dev mode: when on, new log entries use devLogEntryDraftTimeIso. */
  devTimeTravelEnabled: boolean
  setDevTimeTravelEnabled: (enabled: boolean) => void
  lastTripBoatId: string | null
  setLastTripBoatId: (boatId: string | null) => void
  /** Native app: record GPS in background while a trip is in progress. */
  backgroundTripRecording: boolean
  setBackgroundTripRecording: (enabled: boolean) => void
  /** Minimum minutes between auto-tracked log entries. */
  autoTrackIntervalMinutes: number
  setAutoTrackIntervalMinutes: (minutes: number) => void
  /** Also create an entry after moving at least this many metres. */
  autoTrackMinDistanceMeters: number
  setAutoTrackMinDistanceMeters: (meters: number) => void
  /** Basemap: POI/building/transit/landuse visibility (heuristic layer ids). */
  mapBasemapLayerToggles: MapBasemapLayerToggles
  setMapBasemapLayerToggles: (next: Partial<MapBasemapLayerToggles>) => void
}

export const useAppOptionsStore = create<AppOptions>()(
  persist(
    (set) => ({
      devMode: false,
      devLogEntryDraftTimeIso: null,
      devTimeTravelEnabled: false,
      setDevMode: (v) => {
        if (!v) {
          clearDevPositionOverride()
          set({
            devMode: v,
            devLogEntryDraftTimeIso: null,
            devTimeTravelEnabled: false,
          })
          return
        }
        set({ devMode: v })
      },
      setDevLogEntryDraftTimeIso: (iso) => set({ devLogEntryDraftTimeIso: iso }),
      setDevTimeTravelEnabled: (enabled) => set({ devTimeTravelEnabled: enabled }),
      lastTripBoatId: null,
      setLastTripBoatId: (boatId) => set({ lastTripBoatId: boatId }),
      backgroundTripRecording: true,
      setBackgroundTripRecording: (enabled) =>
        set({ backgroundTripRecording: enabled }),
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
    }),
    { name: 'travelmode-app-options' },
  ),
)
