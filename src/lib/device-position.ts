type PositionSnapshot = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  timestamp: string;
};

type PositionListener = (position: PositionSnapshot) => void;

const CACHE_TTL_MS = 30_000;
const listeners = new Set<PositionListener>();
let cached: PositionSnapshot | null = null;
let cachedAt = 0;
let inflight: Promise<PositionSnapshot> | null = null;
let watchId: number | null = null;
let watchSubscribers = 0;
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

async function resolveDevicePosition(): Promise<PositionSnapshot> {
  if (typeof navigator === "undefined") {
    return devFallbackPosition("not supported");
  }

  if (typeof window !== "undefined" && !window.isSecureContext) {
    logInsecureContextOnce();
    return devFallbackPosition("insecure context");
  }

  const highAccuracy = await requestPosition({
    enableHighAccuracy: true,
    maximumAge: CACHE_TTL_MS,
    timeout: 5_000,
  });
  if (highAccuracy?.latitude != null && highAccuracy.longitude != null) {
    return highAccuracy;
  }

  const lowAccuracy = await requestPosition({
    enableHighAccuracy: false,
    maximumAge: 60_000,
    timeout: 10_000,
  });
  if (lowAccuracy?.latitude != null && lowAccuracy.longitude != null) {
    return lowAccuracy;
  }

  return devFallbackPosition("permission denied or timed out");
}

function ensureWatch() {
  if (watchId != null || typeof navigator === "undefined") {
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => publish(toPositionSnapshot(position)),
    () => {},
    { enableHighAccuracy: true, maximumAge: CACHE_TTL_MS },
  );
}

function stopWatchIfIdle() {
  if (watchSubscribers > 0 || watchId == null || typeof navigator === "undefined") {
    return;
  }
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export async function readDevicePosition(options?: { force?: boolean }): Promise<PositionSnapshot> {
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
  } else {
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
