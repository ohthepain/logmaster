import type {
  BackgroundGeolocationPlugin,
  CallbackError,
  Location,
} from '@capacitor-community/background-geolocation'
import { LocalNotifications } from '@capacitor/local-notifications'
import { registerPlugin } from '@capacitor/core'
import { supportsBackgroundGps } from '../platform'

const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

export type BackgroundPosition = {
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
  timestamp: string
}

export type BackgroundTrackerOptions = {
  intervalMinutes: number
  minDistanceMeters: number
  onPosition: (position: BackgroundPosition) => void | Promise<void>
  onError?: (message: string) => void
}

let watcherId: string | null = null
let lastRecordedAt = 0
let lastRecordedLat: number | null = null
let lastRecordedLng: number | null = null
let activeOptions: BackgroundTrackerOptions | null = null

function toIsoTimestamp(location: Location) {
  return new Date(location.time ?? Date.now()).toISOString()
}

function toPosition(location: Location): BackgroundPosition {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy ?? null,
    heading:
      location.bearing != null && Number.isFinite(location.bearing)
        ? location.bearing
        : null,
    timestamp: toIsoTimestamp(location),
  }
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadius = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

function shouldRecord(position: BackgroundPosition) {
  if (!activeOptions) return false

  const intervalMs = activeOptions.intervalMinutes * 60_000
  const elapsed = Date.now() - lastRecordedAt
  if (lastRecordedAt === 0 || elapsed >= intervalMs) {
    return true
  }

  if (lastRecordedLat == null || lastRecordedLng == null) {
    return true
  }

  const moved = haversineMeters(
    lastRecordedLat,
    lastRecordedLng,
    position.latitude,
    position.longitude,
  )
  return moved >= activeOptions.minDistanceMeters
}

async function maybeRecord(position: BackgroundPosition) {
  if (!activeOptions || !shouldRecord(position)) return

  lastRecordedAt = Date.now()
  lastRecordedLat = position.latitude
  lastRecordedLng = position.longitude
  await activeOptions.onPosition(position)
}

async function ensureNotificationPermission() {
  const status = await LocalNotifications.checkPermissions()
  if (status.display === 'granted') return true

  const requested = await LocalNotifications.requestPermissions()
  return requested.display === 'granted'
}

function handleWatcherError(error: CallbackError | undefined) {
  if (!error || !activeOptions?.onError) return

  if (error.code === 'NOT_AUTHORIZED') {
    activeOptions.onError(
      'Location permission is required for background trip recording.',
    )
    return
  }

  activeOptions.onError(error.message ?? 'Background location failed.')
}

export async function startBackgroundTracker(options: BackgroundTrackerOptions) {
  if (!supportsBackgroundGps()) {
    throw new Error('Background GPS is only available in the native app.')
  }

  if (watcherId) {
    await stopBackgroundTracker()
  }

  activeOptions = options
  lastRecordedAt = 0
  lastRecordedLat = null
  lastRecordedLng = null

  await ensureNotificationPermission()

  watcherId = await BackgroundGeolocation.addWatcher(
    {
      backgroundMessage:
        'logmaster is recording your trip position while the app is in the background.',
      backgroundTitle: 'Recording trip',
      requestPermissions: true,
      stale: false,
      distanceFilter: Math.max(10, Math.round(options.minDistanceMeters / 2)),
    },
    (location, error) => {
      if (error) {
        handleWatcherError(error)
        return
      }
      if (!location) return
      void maybeRecord(toPosition(location))
    },
  )
}

export async function stopBackgroundTracker() {
  if (!watcherId) {
    activeOptions = null
    return
  }

  const id = watcherId
  watcherId = null
  activeOptions = null
  lastRecordedAt = 0
  lastRecordedLat = null
  lastRecordedLng = null

  await BackgroundGeolocation.removeWatcher({ id })
}

export function isBackgroundTrackerRunning() {
  return watcherId != null
}

export async function openBackgroundLocationSettings() {
  if (!supportsBackgroundGps()) return
  await BackgroundGeolocation.openSettings()
}
