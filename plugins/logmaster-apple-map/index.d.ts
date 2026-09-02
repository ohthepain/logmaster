import type { PluginListenerHandle } from '@capacitor/core'

export type MapLayout = {
  mapId: string
  passThrough?: MapPassThroughZone[]
}

export type MapPassThroughZone = {
  x: number
  y: number
  width: number
  height: number
}

export type MapCoordinate = {
  latitude: number
  longitude: number
}

export type MapEntryPoint = MapCoordinate & {
  entryId: string
  imageDataUrl?: string
}

export type MapOverlays = {
  mapId: string
  track?: MapCoordinate[]
  entryPoints?: MapEntryPoint[]
}

export type MapSelectedEntry = {
  mapId: string
  selectedEntryId?: string | null
}

export type MapCamera = {
  mapId: string
  center: MapCoordinate
  spanLatitude?: number
  spanLongitude?: number
}

export type MapPlaybackPosition = MapCoordinate & {
  heading: number
  imageDataUrl?: string
}

export type FitCoordinatesOptions = {
  mapId: string
  coordinates: MapCoordinate[]
  /** Uniform edge padding in points (legacy). */
  padding?: number
  /** Fraction of the map view used as margin on each edge (default 0.1). */
  paddingFraction?: number
}

export interface LogmasterAppleMapPlugin {
  create(options: { mapId: string; interactive?: boolean }): Promise<void>
  destroy(options: { mapId: string }): Promise<void>
  setLayout(options: MapLayout): Promise<void>
  setVisible(options: { mapId: string; visible: boolean }): Promise<void>
  setCamera(options: MapCamera): Promise<void>
  fitCoordinates(options: FitCoordinatesOptions): Promise<void>
  setOverlays(options: MapOverlays): Promise<void>
  setSelectedEntry(options: MapSelectedEntry): Promise<void>
  setPlaybackPosition(options: { mapId: string; position?: MapPlaybackPosition | null }): Promise<void>
  setShowsUserLocation(options: { mapId: string; show: boolean; follow?: boolean }): Promise<void>
  setInteractionEnabled(options: { mapId: string; enabled: boolean }): Promise<void>
  setTouchCaptureSuspended(options: { suspended: boolean }): Promise<void>
  adjustZoom(options: { mapId: string; factor: number }): Promise<void>
  snapshotMap(options: { mapId: string }): Promise<{ dataUrl: string }>
  addListener(
    eventName: 'mapReady',
    listenerFunc: (data: { mapId: string }) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'entrySelected',
    listenerFunc: (data: { mapId: string; entryId: string }) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'entryPreview',
    listenerFunc: (data: { mapId: string; entryId: string; x: number; y: number }) => void,
  ): Promise<PluginListenerHandle>
}
