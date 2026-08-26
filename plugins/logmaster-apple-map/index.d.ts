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

export type MapOverlays = {
  mapId: string
  track?: MapCoordinate[]
  entryPoints?: MapCoordinate[]
}

export type MapCamera = {
  mapId: string
  center: MapCoordinate
  spanLatitude?: number
  spanLongitude?: number
}

export type FitCoordinatesOptions = {
  mapId: string
  coordinates: MapCoordinate[]
  padding?: number
}

export interface LogmasterAppleMapPlugin {
  create(options: { mapId: string; interactive?: boolean }): Promise<void>
  destroy(options: { mapId: string }): Promise<void>
  setLayout(options: MapLayout): Promise<void>
  setVisible(options: { mapId: string; visible: boolean }): Promise<void>
  setCamera(options: MapCamera): Promise<void>
  fitCoordinates(options: FitCoordinatesOptions): Promise<void>
  setOverlays(options: MapOverlays): Promise<void>
  setShowsUserLocation(options: { mapId: string; show: boolean; follow?: boolean }): Promise<void>
  setInteractionEnabled(options: { mapId: string; enabled: boolean }): Promise<void>
  setTouchCaptureSuspended(options: { suspended: boolean }): Promise<void>
  adjustZoom(options: { mapId: string; factor: number }): Promise<void>
  addListener(
    eventName: 'mapReady',
    listenerFunc: (data: { mapId: string }) => void,
  ): Promise<PluginListenerHandle>
}
