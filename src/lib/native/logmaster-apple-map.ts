import { registerPlugin } from '@capacitor/core'
import type {
  FitCoordinatesOptions,
  LogmasterAppleMapPlugin,
  MapCamera,
  MapCoordinate,
  MapLayout,
  MapOverlays,
} from 'logmaster-apple-map'

export const LogmasterAppleMap = registerPlugin<LogmasterAppleMapPlugin>('LogmasterAppleMap')

export type {
  FitCoordinatesOptions,
  MapCamera,
  MapCoordinate,
  MapLayout,
  MapOverlays,
}

export type MapEntryPoint = MapCoordinate & {
  entryId: string
  imageDataUrl?: string
}
