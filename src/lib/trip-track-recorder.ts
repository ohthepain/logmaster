import {
  encodePositionTrackSamples,
  encodingForTrackKind,
  type PositionTrackSample,
  type TripTrack,
  type TripTrackSource,
} from '../domain/trip-track'
import { TRIP_TRACK_CHUNK_MAX_MS, TRIP_TRACK_CHUNK_MAX_SAMPLES } from './trip-track-payload'

export type SealedTripTrack = TripTrack

export const OPEN_POSITION_TRACK_ID_PREFIX = 'open-position:'

export function openPositionTrackId(tripId: string) {
  return `${OPEN_POSITION_TRACK_ID_PREFIX}${tripId}`
}

export function isOpenPositionTrack(track: Pick<TripTrack, 'id'>) {
  return track.id.startsWith(OPEN_POSITION_TRACK_ID_PREFIX)
}

type OpenPositionChunk = {
  tripId: string
  legId: string | null
  source: TripTrackSource
  samples: PositionTrackSample[]
}

function chunkKey(tripId: string, kind: string) {
  return `${tripId}:${kind}`
}

function makeId() {
  return crypto.randomUUID()
}

function nowIso() {
  return new Date().toISOString()
}

function validSample(sample: PositionTrackSample): boolean {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    sample.longitude >= -180 &&
    sample.longitude <= 180 &&
    Number.isFinite(Date.parse(sample.time))
  )
}

function buildPositionTrackFromSamples(
  tripId: string,
  legId: string | null,
  source: TripTrackSource,
  samples: PositionTrackSample[],
): SealedTripTrack {
  const payload = encodePositionTrackSamples(samples)
  const now = nowIso()
  return {
    id: makeId(),
    tripId,
    legId,
    source,
    kind: 'position',
    encoding: encodingForTrackKind('position'),
    payload,
    sampleCount: samples.length,
    startedAt: samples[0]!.time,
    endedAt: samples[samples.length - 1]!.time,
    createdAt: now,
    updatedAt: now,
    synced: false,
    storage: 'inline',
    storageKey: null,
    byteLength: null,
    sha256: null,
  }
}

export class TripTrackRecorder {
  private open = new Map<string, OpenPositionChunk>()

  appendPositionSample(
    tripId: string,
    sample: PositionTrackSample,
    options: {
      source: TripTrackSource
      legId?: string | null
    },
  ): SealedTripTrack[] {
    if (!validSample(sample)) return []

    const key = chunkKey(tripId, 'position')
    let chunk = this.open.get(key)
    if (!chunk) {
      chunk = {
        tripId,
        legId: options.legId ?? null,
        source: options.source,
        samples: [],
      }
      this.open.set(key, chunk)
    }

    const last = chunk.samples.at(-1)
    if (last && Date.parse(sample.time) < Date.parse(last.time)) {
      return []
    }
    if (
      last &&
      last.latitude === sample.latitude &&
      last.longitude === sample.longitude &&
      Date.parse(sample.time) === Date.parse(last.time)
    ) {
      return []
    }

    chunk.samples.push(sample)
    return this.sealIfNeeded(key)
  }

  sealIfNeeded(key: string): SealedTripTrack[] {
    const chunk = this.open.get(key)
    if (!chunk || chunk.samples.length === 0) return []

    const spanMs =
      chunk.samples.length >= 2
        ? Date.parse(chunk.samples.at(-1)!.time) -
          Date.parse(chunk.samples[0]!.time)
        : 0

    if (
      chunk.samples.length < TRIP_TRACK_CHUNK_MAX_SAMPLES &&
      spanMs < TRIP_TRACK_CHUNK_MAX_MS
    ) {
      return []
    }

    return [this.sealChunk(key)!].filter(Boolean)
  }

  sealChunk(key: string): SealedTripTrack | null {
    const chunk = this.open.get(key)
    if (!chunk || chunk.samples.length === 0) return null

    const sealed = buildPositionTrackFromSamples(
      chunk.tripId,
      chunk.legId,
      chunk.source,
      chunk.samples,
    )
    this.open.delete(key)
    return sealed
  }

  sealTrip(tripId: string): SealedTripTrack[] {
    const sealed: SealedTripTrack[] = []
    for (const key of [...this.open.keys()]) {
      if (!key.startsWith(`${tripId}:`)) continue
      const track = this.sealChunk(key)
      if (track) sealed.push(track)
    }
    return sealed
  }

  clearTrip(tripId: string) {
    for (const key of [...this.open.keys()]) {
      if (key.startsWith(`${tripId}:`)) {
        this.open.delete(key)
      }
    }
  }

  /** In-memory chunk not yet sealed — used for live map geometry. */
  openPositionTrack(tripId: string): TripTrack | null {
    const chunk = this.open.get(chunkKey(tripId, 'position'))
    if (!chunk || chunk.samples.length < 2) return null

    const payload = encodePositionTrackSamples(chunk.samples)
    const now = nowIso()
    return {
      id: openPositionTrackId(tripId),
      tripId,
      legId: chunk.legId,
      source: chunk.source,
      kind: 'position',
      encoding: encodingForTrackKind('position'),
      payload,
      sampleCount: chunk.samples.length,
      startedAt: chunk.samples[0]!.time,
      endedAt: chunk.samples.at(-1)!.time,
      createdAt: now,
      updatedAt: now,
      synced: false,
      storage: 'inline',
      storageKey: null,
      byteLength: null,
      sha256: null,
    }
  }
}

let recorder: TripTrackRecorder | null = null

export function getTripTrackRecorder(): TripTrackRecorder {
  if (!recorder) recorder = new TripTrackRecorder()
  return recorder
}

export function resetTripTrackRecorder() {
  recorder = null
}
