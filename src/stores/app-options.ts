import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultMapBasemapLayerToggles } from '../lib/maplibre-basemap-layer-toggles'
import type { MapBasemapLayerToggles } from '../lib/maplibre-basemap-layer-toggles'

type AppOptions = {
  devMode: boolean
  setDevMode: (v: boolean) => void
  /** Basemap: POI/building/transit/landuse visibility (heuristic layer ids). */
  mapBasemapLayerToggles: MapBasemapLayerToggles
  setMapBasemapLayerToggles: (next: Partial<MapBasemapLayerToggles>) => void
}

export const useAppOptionsStore = create<AppOptions>()(
  persist(
    (set) => ({
      devMode: false,
      setDevMode: (v) => set({ devMode: v }),
      mapBasemapLayerToggles: defaultMapBasemapLayerToggles(),
      setMapBasemapLayerToggles: (next: Partial<MapBasemapLayerToggles>) =>
        set((s) => ({
          mapBasemapLayerToggles: { ...s.mapBasemapLayerToggles, ...next },
        })),
    }),
    { name: 'travelmode-app-options' },
  ),
)
