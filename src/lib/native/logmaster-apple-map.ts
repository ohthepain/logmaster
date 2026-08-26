import { registerPlugin } from '@capacitor/core'
import type { LogmasterAppleMapPlugin } from 'logmaster-apple-map'

export const LogmasterAppleMap =
  registerPlugin<LogmasterAppleMapPlugin>('LogmasterAppleMap')

export type {
  FitCoordinatesOptions,
  MapCamera,
  MapCoordinate,
  MapLayout,
  MapOverlays,
} from 'logmaster-apple-map'
