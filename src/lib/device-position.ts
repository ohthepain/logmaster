import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

type PositionSnapshot = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  timestamp: string;
};

type PositionListener = (position: PositionSnapshot) => void;

const CACHE_TTL_MS = 30_000;
const GEO_TIMEOUT_MS = 2_000;
const listeners = new Set<PositionListener>();
let cached: PositionSnapshot | null = null;
let cachedAt = 0;
let inflight: Promise<PositionSnapshot> | null = null;
let watchId: number | null = null;
let nativeWatchId: string | null = null;
let watchSubscribers = 0;
let locationAccessEnabled = false;
let devFallbackLogged = false;
let insecureContextLogged = false;

function freshTimestamp() {
  return new Date().toISOString();
}

function cloneCached(position: PositionSnapshot): PositionSnapshot {
  return { ...position, timestamp: freshTimestamp() };
}

function isFresh() {
  return cached != null && Date.now() - cachedAt < CACHE_TTL_MS;
}

let devPositionOverride: Pick<
  PositionSnapshot,
  'latitude' | 'longitude' | 'accuracy' | 'heading'
> | null = null;

export function setDevPositionOverride(position: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
} | null) {
  devPositionOverride = position
    ? {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy ?? null,
        heading: position.heading ?? null,
      }
    : null;
  if (!devPositionOverride) return;
  const override = devPositionOverride;
  publish({
    latitude: override.latitude,
    longitude: override.longitude,
    accuracy: override.accuracy,
    heading: override.heading,
    timestamp: freshTimestamp(),
  });
}

export function clearDevPositionOverride() {
  devPositionOverride = null;
}

export function getDevPositionOverride() {
  return devPositionOverride;
}

function devOverrideSnapshot(): PositionSnapshot | null {
  if (!devPositionOverride) return null;
  return {
    latitude: devPositionOverride.latitude,
    longitude: devPositionOverride.longitude,
    accuracy: null,
    heading: null,
    timestamp: freshTimestamp(),
  };
}

function publish(position: PositionSnapshot) {
  cached = position;
  cachedAt = Date.now();
  for (const listener of listeners) listener(position);
}

function logDevFallbackOnce(detail?: string) {
  if (!import.meta.env.DEV || devFallbackLogged) return;
  devFallbackLogged = true;
  const suffix = detail ? ` (${detail})` : "";
  console.info(
    `[logmaster] Geolocation unavailable${suffix}; using dev fallback position (Cowes, Isle of Wight). Grant location permission or use http://localhost:3020 to use GPS.`,
  );
}

function logInsecureContextOnce() {
  if (insecureContextLogged) return;
  insecureContextLogged = true;
  console.warn("[logmaster] Geolocation requires a secure context. Use http://localhost:3020 during development.");
}

function toPositionSnapshot(position: GeolocationPosition): PositionSnapshot {
  const heading = position.coords.heading;
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: heading != null && Number.isFinite(heading) ? heading : null,
    timestamp: new Date(position.timestamp).toISOString(),
  };
}

function requestPosition(options: PositionOptions): Promise<PositionSnapshot | null> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toPositionSnapshot(position)),
      () => resolve(null),
      options,
    );
  });
}

function devFallbackPosition(detail?: string): PositionSnapshot {
  logDevFallbackOnce(detail);
  return {
    latitude: 50.7628,
    longitude: -1.2974,
    accuracy: null,
    heading: null,
    timestamp: freshTimestamp(),
  };
}

export function isLocationAccessEnabled() {
  return locationAccessEnabled;
}

/** Start or stop GPS access. Permission prompts only happen while this is enabled. */
export function setLocationAccessEnabled(enabled: boolean) {
  if (locationAccessEnabled === enabled) return;
  locationAccessEnabled = enabled;
  if (enabled) {
    if (watchSubscribers > 0) {
      ensureWatch();
    }
    return;
  }
  stopWatches();
}

async function resolveNativeDevicePosition(): Promise<PositionSnapshot | null> {
  if (
    !locationAccessEnabled ||
    typeof window === 'undefined' ||
    !Capacitor.isNativePlatform()
  ) {
    return null
  }

  try {
    let permissions = await Geolocation.checkPermissions()
    if (
      permissions.location === 'prompt' ||
      permissions.location === 'prompt-with-rationale'
    ) {
      permissions = await Geolocation.requestPermissions()
    }
    if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
      return null
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
    })

    const heading = position.coords.heading
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: heading != null && Number.isFinite(heading) ? heading : null,
      timestamp: new Date(position.timestamp).toISOString(),
    }
  } catch {
    return null
  }
}

async function resolveDevicePosition(): Promise<PositionSnapshot> {
  const override = devOverrideSnapshot();
  if (override) return override;

  if (!locationAccessEnabled) {
    if (cached) return cloneCached(cached);
    return devFallbackPosition("recording paused");
  }

  const nativePosition = await resolveNativeDevicePosition()
  if (nativePosition) return nativePosition

  if (typeof navigator === "undefined") {
    return devFallbackPosition("not supported");
  }

  if (typeof window !== "undefined" && !window.isSecureContext) {
    logInsecureContextOnce();
    return devFallbackPosition("insecure context");
  }

  const [highAccuracy, lowAccuracy] = await Promise.all([
    requestPosition({
      enableHighAccuracy: true,
      maximumAge: CACHE_TTL_MS,
      timeout: GEO_TIMEOUT_MS,
    }),
    requestPosition({
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: GEO_TIMEOUT_MS,
    }),
  ]);
  if (highAccuracy?.latitude != null && highAccuracy.longitude != null) {
    return highAccuracy;
  }
  if (lowAccuracy?.latitude != null && lowAccuracy.longitude != null) {
    return lowAccuracy;
  }

  return devFallbackPosition("permission denied or timed out");
}

async function ensureNativeWatch() {
  if (
    !locationAccessEnabled ||
    nativeWatchId != null ||
    typeof window === "undefined" ||
    !Capacitor.isNativePlatform()
  ) {
    return;
  }

  nativeWatchId = await Geolocation.watchPosition(
    { enableHighAccuracy: true },
    (position, error) => {
      if (error || devPositionOverride || !position) return;
      const heading = position.coords.heading;
      publish({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: heading != null && Number.isFinite(heading) ? heading : null,
        timestamp: new Date(position.timestamp).toISOString(),
      });
    },
  );
}

function ensureWatch() {
  if (!locationAccessEnabled) {
    return;
  }

  if (Capacitor.isNativePlatform()) {
    void ensureNativeWatch();
    return;
  }

  if (watchId != null || typeof navigator === "undefined") {
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (devPositionOverride) return;
      publish(toPositionSnapshot(position));
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: CACHE_TTL_MS },
  );
}

function stopWatches() {
  if (nativeWatchId != null) {
    void Geolocation.clearWatch({ id: nativeWatchId });
    nativeWatchId = null;
  }

  if (watchId == null || typeof navigator === "undefined") {
    return;
  }
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

function stopWatchIfIdle() {
  if (watchSubscribers > 0 && locationAccessEnabled) {
    return;
  }
  stopWatches();
}

export async function readDevicePosition(options?: { force?: boolean }): Promise<PositionSnapshot> {
  const override = devOverrideSnapshot();
  if (override) return override;

  if (!locationAccessEnabled) {
    if (cached) return cloneCached(cached);
    return devFallbackPosition("recording paused");
  }

  if (!options?.force && isFresh() && cached) {
    return cloneCached(cached);
  }

  if (!options?.force && inflight) {
    return inflight;
  }

  inflight = resolveDevicePosition()
    .then((position) => {
      publish(position);
      return position;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function subscribeToDevicePosition(listener: PositionListener) {
  listeners.add(listener);
  watchSubscribers += 1;
  ensureWatch();

  if (cached) {
    listener(cached);
  } else if (locationAccessEnabled) {
    void readDevicePosition();
  }

  return () => {
    listeners.delete(listener);
    watchSubscribers = Math.max(0, watchSubscribers - 1);
    stopWatchIfIdle();
  };
}

export function getCachedDevicePosition() {
  return cached;
}
