import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

export type PositionSnapshot = {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  heading: number | null
  timestamp: string
}

type PositionListener = (position: PositionSnapshot) => void

const CACHE_TTL_MS = 30_000
const GEO_TIMEOUT_MS = 10_000
const listeners = new Set<PositionListener>()
let cached: PositionSnapshot | null = null
let cachedAt = 0
let inflight: Promise<PositionSnapshot> | null = null
let watchId: number | null = null
let nativeWatchId: string | null = null
let watchSubscribers = 0
let locationAccessEnabled = false
let devFallbackLogged = false

function freshTimestamp() {
  return new Date().toISOString()
}

function cloneCached(position: PositionSnapshot): PositionSnapshot {
  return { ...position, timestamp: freshTimestamp() }
}

function isFresh() {
  return cached != null && Date.now() - cachedAt < CACHE_TTL_MS
}

let devPositionOverride: Pick<
  PositionSnapshot,
  'latitude' | 'longitude' | 'accuracy' | 'heading'
> | null = null

export function setDevPositionOverride(
  position: {
    latitude: number
    longitude: number
    accuracy?: number | null
    heading?: number | null
  } | null,
) {
  devPositionOverride = position
    ? {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy ?? null,
        heading: position.heading ?? null,
      }
    : null
  if (!devPositionOverride) return
  const override = devPositionOverride
  publish({
    latitude: override.latitude,
    longitude: override.longitude,
    accuracy: override.accuracy,
    heading: override.heading,
    timestamp: freshTimestamp(),
  })
}

export function clearDevPositionOverride() {
  devPositionOverride = null
}

export function getDevPositionOverride() {
  return devPositionOverride
}

function devOverrideSnapshot(): PositionSnapshot | null {
  if (!devPositionOverride) return null
  return {
    latitude: devPositionOverride.latitude,
    longitude: devPositionOverride.longitude,
    accuracy: null,
    heading: null,
    timestamp: freshTimestamp(),
  }
}

function publish(position: PositionSnapshot) {
  cached = position
  cachedAt = Date.now()
  for (const listener of listeners) listener(position)
}

function logDevFallbackOnce(detail?: string) {
  if (!import.meta.env.DEV || devFallbackLogged) return
  devFallbackLogged = true
  const suffix = detail ? ` (${detail})` : ''
  console.info(
    `[logmaster] Geolocation unavailable${suffix}; using dev fallback position (Cowes, Isle of Wight). Grant location permission or use http://localhost:3020 to use GPS.`,
  )
}

function toPositionSnapshot(position: {
  coords: {
    latitude: number
    longitude: number
    accuracy: number
    heading: number | null
  }
  timestamp: number
}): PositionSnapshot {
  const heading = position.coords.heading
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: heading != null && Number.isFinite(heading) ? heading : null,
    timestamp: new Date(position.timestamp).toISOString(),
  }
}

export type LocationFailure = 'denied' | 'timeout' | 'unavailable'
export type LocationPermission = 'granted' | 'prompt' | 'denied' | 'unavailable'
export type DevicePositionResult =
  | { status: 'success'; position: PositionSnapshot }
  | { status: LocationFailure }

export function locationFailure(error: unknown): LocationFailure {
  const code = (error as { code?: string | number } | null)?.code
  if (code === 1 || code === 'OS-PLUG-GLOC-0003') return 'denied'
  if (code === 3 || code === 'OS-PLUG-GLOC-0010') return 'timeout'
  return 'unavailable'
}

/** Checks permission without triggering a system prompt. */
export async function checkLocationPermission(): Promise<LocationPermission> {
  if (devPositionOverride) return 'granted'
  try {
    if (Capacitor.isNativePlatform()) {
      const permissions = await Geolocation.checkPermissions()
      if (
        permissions.location === 'granted' ||
        permissions.coarseLocation === 'granted'
      )
        return 'granted'
      return permissions.location === 'denied' ? 'denied' : 'prompt'
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation)
      return 'unavailable'
    if (typeof window !== 'undefined' && !window.isSecureContext)
      return 'unavailable'
    if (!navigator.permissions?.query) return 'prompt'
    const permission = await navigator.permissions.query({
      name: 'geolocation',
    })
    return permission.state
  } catch {
    // Browsers without a geolocation permission query still support a user-initiated read.
    return Capacitor.isNativePlatform() ? 'unavailable' : 'prompt'
  }
}

function requestPosition(
  options: PositionOptions,
): Promise<DevicePositionResult> {
  return new Promise<DevicePositionResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ status: 'success', position: toPositionSnapshot(position) }),
      (error) => resolve({ status: locationFailure(error) }),
      options,
    )
  }).catch((error: unknown) => ({ status: locationFailure(error) }))
}

/** A real location result: never substitutes a development fallback for failure. */
export async function requestDevicePosition(
  onLocating?: () => void,
): Promise<DevicePositionResult> {
  const override = devOverrideSnapshot()
  if (override) return { status: 'success', position: override }
  try {
    let result: DevicePositionResult
    if (Capacitor.isNativePlatform()) {
      let permission = await checkLocationPermission()
      if (permission === 'prompt') {
        const requested = await Geolocation.requestPermissions()
        permission =
          requested.location === 'granted' ||
          requested.coarseLocation === 'granted'
            ? 'granted'
            : 'denied'
      }
      if (permission !== 'granted')
        return { status: permission === 'denied' ? 'denied' : 'unavailable' }
      onLocating?.()
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: GEO_TIMEOUT_MS,
      })
      result = {
        status: 'success',
        position: toPositionSnapshot(position),
      }
    } else {
      if (
        typeof navigator === 'undefined' ||
        !navigator.geolocation ||
        (typeof window !== 'undefined' && !window.isSecureContext)
      )
        return { status: 'unavailable' }
      // PermissionStatus changes when the browser prompt is accepted, before the first fix.
      let permission: PermissionStatus | undefined
      const changed = () => {
        if (permission?.state === 'granted') onLocating?.()
      }
      try {
        permission = await navigator.permissions?.query({ name: 'geolocation' })
      } catch {
        /* Unsupported browser. */
      }
      permission?.addEventListener('change', changed)
      changed()
      try {
        // Reveal the first usable fix even if the other accuracy request is still pending.
        result = await new Promise<DevicePositionResult>((resolve) => {
          const failures: DevicePositionResult[] = []
          for (const enableHighAccuracy of [true, false]) {
            void requestPosition({
              enableHighAccuracy,
              maximumAge: CACHE_TTL_MS,
              timeout: GEO_TIMEOUT_MS,
            }).then((response) => {
              if (response.status === 'success') resolve(response)
              else {
                failures.push(response)
                if (failures.length === 2)
                  resolve(
                    failures.find((item) => item.status === 'denied') ??
                      failures.find((item) => item.status === 'timeout') ?? {
                        status: 'unavailable',
                      },
                  )
              }
            })
          }
        })
      } finally {
        permission?.removeEventListener('change', changed)
      }
    }
    if (result.status === 'success') publish(result.position)
    return result
  } catch (error) {
    return { status: locationFailure(error) }
  }
}

function unavailablePosition(): PositionSnapshot {
  return {
    latitude: null,
    longitude: null,
    accuracy: null,
    heading: null,
    timestamp: freshTimestamp(),
  }
}

function isResolvedPosition(position: PositionSnapshot) {
  return position.latitude != null && position.longitude != null
}

function fallbackOrUnavailable(detail?: string): PositionSnapshot {
  if (import.meta.env.DEV) {
    logDevFallbackOnce(detail)
    return {
      latitude: 50.7628,
      longitude: -1.2974,
      accuracy: null,
      heading: null,
      timestamp: freshTimestamp(),
    }
  }
  return unavailablePosition()
}

export function isLocationAccessEnabled() {
  return locationAccessEnabled
}

/** Start or stop the continuous GPS watch. One-shot reads may still request location. */
export function setLocationAccessEnabled(enabled: boolean) {
  if (locationAccessEnabled === enabled) return
  locationAccessEnabled = enabled
  if (enabled) {
    if (watchSubscribers > 0) {
      ensureWatch()
    }
    return
  }
  stopWatches()
}

async function resolveDevicePosition(): Promise<PositionSnapshot> {
  const result = await requestDevicePosition()
  return result.status === 'success'
    ? result.position
    : fallbackOrUnavailable(result.status)
}

async function ensureNativeWatch() {
  if (
    !locationAccessEnabled ||
    nativeWatchId != null ||
    typeof window === 'undefined' ||
    !Capacitor.isNativePlatform()
  ) {
    return
  }

  nativeWatchId = await Geolocation.watchPosition(
    { enableHighAccuracy: true },
    (position, error) => {
      if (error || devPositionOverride || !position) return
      const heading = position.coords.heading
      publish({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: heading != null && Number.isFinite(heading) ? heading : null,
        timestamp: new Date(position.timestamp).toISOString(),
      })
    },
  )
}

function ensureWatch() {
  if (!locationAccessEnabled) {
    return
  }

  if (Capacitor.isNativePlatform()) {
    void ensureNativeWatch()
    return
  }

  if (watchId != null || typeof navigator === 'undefined') {
    return
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (devPositionOverride) return
      publish(toPositionSnapshot(position))
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: CACHE_TTL_MS },
  )
}

function stopWatches() {
  if (nativeWatchId != null) {
    void Geolocation.clearWatch({ id: nativeWatchId })
    nativeWatchId = null
  }

  if (watchId == null || typeof navigator === 'undefined') {
    return
  }
  navigator.geolocation.clearWatch(watchId)
  watchId = null
}

function stopWatchIfIdle() {
  if (watchSubscribers > 0 && locationAccessEnabled) {
    return
  }
  stopWatches()
}

export async function readDevicePosition(options?: {
  force?: boolean
}): Promise<PositionSnapshot> {
  const override = devOverrideSnapshot()
  if (override) return override

  if (!options?.force && isFresh() && cached) {
    return cloneCached(cached)
  }

  if (!options?.force && inflight) {
    return inflight
  }

  inflight = resolveDevicePosition()
    .then((position) => {
      if (isResolvedPosition(position) && cached !== position) {
        publish(position)
      }
      return position
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

export function subscribeToDevicePosition(
  listener: PositionListener,
  options?: { passive?: boolean },
) {
  listeners.add(listener)
  watchSubscribers += 1
  ensureWatch()

  if (cached) {
    listener(cached)
  } else if (!options?.passive) {
    void readDevicePosition()
  }

  return () => {
    listeners.delete(listener)
    watchSubscribers = Math.max(0, watchSubscribers - 1)
    stopWatchIfIdle()
  }
}

export function getCachedDevicePosition() {
  return cached
}
